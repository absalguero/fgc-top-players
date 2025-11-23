// ./lib/startggUpcoming.js
const fs = require("fs").promises;
const path = require("path");
const os = require("os");
const { DateTime } = require("luxon");
const { query } = require("./startggApi");

// Bring in overrides so we can apply archive/exclude rules consistently
let upcomingOverrides = {};
try {
  // Adjust path if your overrides file lives somewhere else
  upcomingOverrides = require("../upcomingTournamentsOverrides.json");
} catch (e) {
  console.warn(
    "[startggUpcoming] Could not load upcomingTournamentsOverrides.json, proceeding without overrides"
  );
  upcomingOverrides = {};
}

// Build a set of slugs that should *never* be treated as upcoming
const ARCHIVED_OR_EXCLUDED_SLUGS = new Set(
  Object.entries(upcomingOverrides || {})
    .filter(([, value]) => {
      return (
        value &&
        typeof value === "object" &&
        (value.excludeFromSite === true || value.isArchived === true)
      );
    })
    .map(([slug]) => String(slug).toLowerCase())
);

const CACHE_DIR =
  process.env.STARTGG_UPCOMING_CACHE_DIR ||
  path.join(os.tmpdir(), "fgctp_startgg_upcoming");
const CACHE_FILE = path.join(CACHE_DIR, "cache.json");

const PLAYER_TTL_HOURS = Number.isFinite(
  Number(process.env.STARTGG_UPCOMING_PLAYER_TTL)
)
  ? Number(process.env.STARTGG_UPCOMING_PLAYER_TTL)
  : 24 * 6;
const TOURNAMENT_TTL_HOURS = Number.isFinite(
  Number(process.env.STARTGG_UPCOMING_TOURNAMENT_TTL)
)
  ? Number(process.env.STARTGG_UPCOMING_TOURNAMENT_TTL)
  : 24;
const REQUEST_THROTTLE_MS = Number.isFinite(
  Number(process.env.STARTGG_UPCOMING_THROTTLE_MS)
)
  ? Number(process.env.STARTGG_UPCOMING_THROTTLE_MS)
  : 250;
const MAX_EVENT_DURATION_DAYS = Number.isFinite(
  Number(process.env.STARTGG_UPCOMING_MAX_DURATION_DAYS)
)
  ? Number(process.env.STARTGG_UPCOMING_MAX_DURATION_DAYS)
  : 14;

async function ensureCacheDir() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

async function loadCache() {
  try {
    await ensureCacheDir();
    const raw = await fs.readFile(CACHE_FILE, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.warn("[startggUpcoming] Failed to read cache:", err.message);
    }
    return { players: {}, tournaments: {}, lastUpdated: null };
  }
}

async function saveCache(cache) {
  try {
    await ensureCacheDir();
    await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (err) {
    console.warn("[startggUpcoming] Failed to write cache:", err.message);
  }
}

function isFresh(timestamp, ttlHours) {
  if (!timestamp) return false;
  const fetched = DateTime.fromISO(timestamp, { zone: "utc" });
  if (!fetched.isValid) return false;
  return DateTime.utc().diff(fetched, "hours").hours < ttlHours;
}

function normalizeTournamentSlug(slug) {
  if (!slug) return null;
  const trimmed = String(slug).trim();
  if (!trimmed) return null;
  const parts = trimmed.split("/");
  return parts[parts.length - 1].toLowerCase();
}

function formatLocation(city, state, country, address) {
  if (address && String(address).trim()) {
    return String(address).trim();
  }

  const parts = [city, state, country]
    .map((value) => (value ? String(value).trim() : ""))
    .filter(Boolean);
  if (parts.length > 0) return parts.join(", ");
  return "To be announced";
}

function formatDateRange(startAt, endAt, timezone) {
  if (!startAt) return "Date to be announced";
  const zone = timezone || "utc";
  const start = DateTime.fromSeconds(startAt, { zone });
  const end = endAt ? DateTime.fromSeconds(endAt, { zone }) : null;
  if (!start.isValid) return "Date to be announced";

  if (!end || !end.isValid || end.hasSame(start, "day")) {
    return start.toFormat("MMM d, yyyy");
  }

  if (start.year === end.year) {
    if (start.month === end.month) {
      return `${start.toFormat("MMM d")}-${end.toFormat("d, yyyy")}`;
    }
    return `${start.toFormat("MMM d")}-${end.toFormat("MMM d, yyyy")}`;
  }

  return `${start.toFormat("MMM d, yyyy")}-${end.toFormat("MMM d, yyyy")}`;
}

function deriveTier(maxEntrants) {
  if (!Number.isFinite(maxEntrants)) return "B";
  if (maxEntrants >= 512) return "S+";
  if (maxEntrants >= 256) return "S";
  if (maxEntrants >= 128) return "A";
  return "B";
}

function buildDescription(name, dates, location, games, notablePlayers) {
  const playersText =
    notablePlayers && notablePlayers.length
      ? ` Registered top players include ${notablePlayers
          .slice(0, 6)
          .join(", ")}.`
      : "";
  const gamesText = games ? ` Featuring ${games}.` : "";
  return `${name} is scheduled for ${dates} in ${location}.${gamesText}${playersText}`.trim();
}

async function delay(ms) {
  if (!ms) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

// Helper: is this event still upcoming or ongoing?
function isUpcomingOrOngoing(startAt, endAt) {
  if (!startAt && !endAt) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const effectiveEnd = endAt || startAt;
  return !effectiveEnd || effectiveEnd >= nowSeconds;
}

async function fetchPlayerEvents(startggSlug, cache) {
  const key = String(startggSlug || "").toLowerCase();
  if (!key) return [];

  const cached = cache.players[key];
  if (cached && isFresh(cached.fetchedAt, PLAYER_TTL_HOURS)) {
    return cached.events || [];
  }

  const queryStr = `
    query PlayerUpcoming($slug: String!) {
      user(slug: $slug) {
        tournaments(
          query: {
            page: 1,
            perPage: 12,
            sortBy: "startAt",
            filter: { upcoming: true }
          }
        ) {
          nodes {
            id
            name
            slug
            startAt
            endAt
            city
            addrState
            countryCode
            venueName
            venueAddress
          }
        }
      }
    }
  `;

  await delay(REQUEST_THROTTLE_MS);
  const data = await query(queryStr, { slug: key });
  const nodes = data?.user?.tournaments?.nodes;
  const events = Array.isArray(nodes) ? nodes : [];

  const normalized = events
    .map((event) => {
      const normalizedSlug = normalizeTournamentSlug(event.slug);
      if (!normalizedSlug || !event.startAt) return null;
      return {
        slug: normalizedSlug,
        name: event.name || normalizedSlug,
        startAt: event.startAt,
        endAt: event.endAt || event.startAt,
        city: event.city || "",
        state: event.addrState || "",
        country: event.countryCode || "",
        venueName: event.venueName || "",
        venueAddress: event.venueAddress || "",
      };
    })
    .filter(Boolean);

  cache.players[key] = {
    fetchedAt: DateTime.utc().toISO(),
    events: normalized,
  };

  return normalized;
}

async function fetchTournamentDetails(slug, cache) {
  const normalizedSlug = normalizeTournamentSlug(slug);
  if (!normalizedSlug) return null;

  // Global override guard
  if (ARCHIVED_OR_EXCLUDED_SLUGS.has(normalizedSlug)) {
    return null;
  }

  const cached = cache.tournaments[normalizedSlug];
  if (cached) {
    const hasIsOnline =
      Array.isArray(cached.data?.events) &&
      cached.data.events.every(
        (evt) => typeof evt?.isOnline !== "undefined"
      );
    if (hasIsOnline && isFresh(cached.fetchedAt, TOURNAMENT_TTL_HOURS)) {
      return cached.data;
    }
  }

  const queryStr = `
    query TournamentDetails($slug: String!) {
      tournament(slug: $slug) {
        id
        name
        slug
        startAt
        endAt
        timezone
        city
        addrState
        postalCode
        countryCode
        venueName
        venueAddress
        url
        events {
          id
          name
          startAt
          numEntrants
          isOnline
          videogame {
            name
          }
        }
      }
    }
  `;

  await delay(REQUEST_THROTTLE_MS);
  const data = await query(queryStr, { slug: normalizedSlug });
  const tournament = data?.tournament || null;

  cache.tournaments[normalizedSlug] = {
    fetchedAt: DateTime.utc().toISO(),
    data: tournament,
  };

  return tournament;
}

function toISODate(seconds, timezone) {
  if (!seconds) return null;
  const zone = timezone || "utc";
  const dt = DateTime.fromSeconds(seconds, { zone });
  return dt.isValid ? dt.toISODate() : null;
}

function deriveGames(events) {
  if (!Array.isArray(events) || events.length === 0) return "";
  const names = Array.from(
    new Set(
      events
        .map((evt) => evt?.videogame?.name)
        .filter((name) => !!name)
        .map((name) => String(name).trim())
    )
  );
  return names.join(", ");
}

async function collectUpcomingForPlayers(players, options = {}) {
  const { topN = 40, offlineOnly = false } = options;
  const cache = await loadCache();

  const filteredPlayers = Array.isArray(players)
    ? players
        .filter((player) => player && player.startggSlug)
        .map((player) => ({
          name: player.name || player.Player || "Unknown Player",
          startggSlug: String(player.startggSlug).toLowerCase(),
          profileSlug:
            player.profileSlug || player.slug || player.Player || player.name,
          rank: Number(
            player.rank || player.Rank || player.position || Infinity
          ),
        }))
        .filter((player) => Number.isFinite(player.rank))
        .sort((a, b) => a.rank - b.rank)
        .slice(0, topN)
    : [];

  const slugToPlayers = new Map();
  filteredPlayers.forEach((player) => {
    const key = player.startggSlug;
    if (!slugToPlayers.has(key)) {
      slugToPlayers.set(key, []);
    }
    slugToPlayers.get(key).push(player);
  });

  const tournamentsBasic = new Map();
  const tournamentPlayers = new Map();
  const playerEventMap = new Map();

  for (const [slug, associatedPlayers] of slugToPlayers.entries()) {
    const events = await fetchPlayerEvents(slug, cache);
    if (!events || events.length === 0) continue;

    // Only keep events that are actually in the future or ongoing *right now*
    const upcomingEvents = events.filter((evt) =>
      isUpcomingOrOngoing(evt.startAt, evt.endAt)
    );
    if (upcomingEvents.length === 0) continue;

    associatedPlayers.forEach((player) => {
      if (!playerEventMap.has(player.profileSlug)) {
        playerEventMap.set(player.profileSlug, new Map());
      }
    });

    upcomingEvents.forEach((event) => {
      // Skip tournaments that your overrides say are archived/excluded
      if (ARCHIVED_OR_EXCLUDED_SLUGS.has(event.slug)) {
        return;
      }

      tournamentsBasic.set(event.slug, {
        slug: event.slug,
        name: event.name,
        startAt: event.startAt,
        endAt: event.endAt,
        city: event.city,
        state: event.state,
        country: event.country,
        venueName: event.venueName || "",
        venueAddress: event.venueAddress || "",
      });

      if (!tournamentPlayers.has(event.slug)) {
        tournamentPlayers.set(event.slug, []);
      }

      associatedPlayers.forEach((player) => {
        tournamentPlayers.get(event.slug).push({
          name: player.name,
          rank: player.rank,
        });
        const eventsForPlayer = playerEventMap.get(player.profileSlug);
        if (!eventsForPlayer.has(event.slug)) {
          eventsForPlayer.set(event.slug, {
            slug: event.slug,
            startAt: event.startAt,
            endAt: event.endAt,
            name: event.name,
            location: formatLocation(
              event.city,
              event.state,
              event.country
            ),
            venueName: event.venueName || "",
          });
        }
      });
    });
  }

  const tournamentsBySlug = {};
  for (const [slug, basic] of tournamentsBasic.entries()) {
    // Guard again on overrides
    if (ARCHIVED_OR_EXCLUDED_SLUGS.has(slug)) {
      continue;
    }

    const details = await fetchTournamentDetails(slug, cache);

    if (!details) {
      const fallbackStart = basic.startAt || null;
      const fallbackEnd = basic.endAt || basic.startAt || null;

      // Drop if already in the past
      if (!isUpcomingOrOngoing(fallbackStart, fallbackEnd)) {
        continue;
      }

      if (fallbackStart && fallbackEnd) {
        const durationDays = (fallbackEnd - fallbackStart) / 86400;
        if (durationDays > MAX_EVENT_DURATION_DAYS) {
          continue;
        }
      }

      if (!offlineOnly) {
        const fallbackDates = formatDateRange(
          fallbackStart,
          fallbackEnd,
          "utc"
        );
        tournamentsBySlug[slug] = {
          name: basic.name || slug,
          slug,
          startAt: fallbackStart,
          endAt: fallbackEnd,
          startDate: toISODate(fallbackStart, "utc"),
          endDate: toISODate(fallbackEnd, "utc"),
          dates: fallbackDates,
          location: formatLocation(
            basic.city,
            basic.state,
            basic.country,
            basic.venueAddress
          ),
          venueName: basic.venueName || "",
          url: `https://www.start.gg/tournament/${slug}`,
          tier: "Event",
          prizes: "TBA",
          game: "",
          streamLink: "",
          scheduleLink: "",
          description: `${basic.name || slug} is scheduled for ${fallbackDates}.`,
          notablePlayers: (tournamentPlayers.get(slug) || [])
            .sort((a, b) => a.rank - b.rank)
            .map((entry) => entry.name),
          isArchived: false,
        };
      }
      continue;
    }

    const allEvents = Array.isArray(details.events)
      ? details.events.filter((evt) => !!evt)
      : [];
    const relevantEvents = offlineOnly
      ? allEvents.filter((evt) => evt.isOnline === false)
      : allEvents;

    const sf6Events = relevantEvents.filter((evt) => {
      const gameName = evt?.videogame?.name;
      return gameName && gameName.toLowerCase().includes("street fighter 6");
    });

    if (sf6Events.length === 0) {
      continue;
    }

    const startAt = details.startAt || basic.startAt || null;
    const endAt = details.endAt || basic.endAt || startAt || null;

    // Drop tournaments that are now fully in the past
    if (!isUpcomingOrOngoing(startAt, endAt)) {
      continue;
    }

    if (startAt && endAt) {
      const durationDays = (endAt - startAt) / 86400;
      if (durationDays > MAX_EVENT_DURATION_DAYS) {
        continue;
      }
    }

    const timezone = details.timezone || "utc";
    const dates = formatDateRange(startAt, endAt, timezone);
    const startDateISO = toISODate(startAt, timezone);
    const endDateISO = toISODate(endAt, timezone);
    const games = "Street Fighter 6";
    const maxEntrants = sf6Events.length
      ? Math.max(
          ...sf6Events
            .map((evt) => evt?.numEntrants)
            .filter((num) => Number.isFinite(num))
        )
      : NaN;
    const tier = deriveTier(maxEntrants);
    const location = formatLocation(
      details.city,
      details.addrState || details.postalCode,
      details.countryCode,
      details.venueAddress
    );
    const playersForTournament = (tournamentPlayers.get(slug) || [])
      .sort((a, b) => a.rank - b.rank)
      .map((entry) => entry.name);
    const description = buildDescription(
      details.name || basic.name || slug,
      dates,
      location,
      games,
      playersForTournament
    );
    const venueName = details.venueName || basic.venueName || "";

    tournamentsBySlug[slug] = {
      name: details.name || basic.name || slug,
      slug,
      startAt,
      endAt,
      startDate: startDateISO,
      endDate: endDateISO,
      dates,
      location,
      venueName,
      url: details.url
        ? `https://www.start.gg${details.url}`
        : `https://www.start.gg/tournament/${slug}`,
      tier,
      prizes: "TBA",
      game: games || "Street Fighter 6",
      streamLink: "",
      scheduleLink: "",
      description,
      notablePlayers: playersForTournament,
      isArchived: false,
    };
  }

  const allowedSlugs = new Set(Object.keys(tournamentsBySlug));
  const playerUpcomingMap = {};
  playerEventMap.forEach((eventsMap, playerId) => {
    const entries = Array.from(eventsMap.values())
      .filter((entry) => allowedSlugs.has(entry.slug))
      .map((entry) => {
        const details = tournamentsBySlug[entry.slug];
        if (details) {
          return {
            slug: entry.slug,
            name: details.name,
            dates: details.dates,
            startDate: details.startDate,
            endDate: details.endDate,
            location: details.location,
            tier: details.tier || "B",
            venueName: details.venueName || "",
          };
        }

        const dates = formatDateRange(entry.startAt, entry.endAt, "utc");
        return {
          slug: entry.slug,
          name: entry.name,
          dates,
          startDate: toISODate(entry.startAt, "utc"),
          endDate: toISODate(entry.endAt, "utc"),
          location: entry.location,
          tier: entry.tier || "B",
          venueName: entry.venueName || "",
        };
      });

    entries.sort((a, b) => {
      if (!a.startDate && !b.startDate) return a.name.localeCompare(b.name);
      if (!a.startDate) return 1;
      if (!b.startDate) return -1;
      if (a.startDate === b.startDate) {
        return a.name.localeCompare(b.name);
      }
      return a.startDate.localeCompare(b.startDate);
    });

    playerUpcomingMap[playerId] = entries;
  });

  cache.lastUpdated = DateTime.utc().toISO();
  await saveCache(cache);

  return {
    playerUpcomingMap,
    tournamentsBySlug,
    lastUpdated: cache.lastUpdated,
  };
}

async function readUpcomingCache() {
  const cache = await loadCache();
  return {
    playerCache: cache.players || {},
    tournamentCache: cache.tournaments || {},
    lastUpdated: cache.lastUpdated,
  };
}

module.exports = {
  collectUpcomingForPlayers,
  readUpcomingCache,
};