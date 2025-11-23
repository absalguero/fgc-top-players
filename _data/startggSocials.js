const EleventyFetch = require("@11ty/eleventy-fetch");
const Papa = require("papaparse");
const fs = require("fs").promises;
const path = require("path");
const os = require("os");
const { batchGetUserSocials } = require("./lib/startggApi");

const DISABLE_STARTGG_FETCH =
  process.env.DISABLE_STARTGG_FETCH === "true" ||
  process.env.DISABLE_STARTGG_FETCH === "1";

let priorityPlayers = null;
try {
  priorityPlayers = require("./priorityPlayers.json");
  if (Array.isArray(priorityPlayers)) {
    console.log("[startggSocials] Loaded priorityPlayers.json");
  }
} catch {
  priorityPlayers = null;
}

const CACHE_DIR =
  process.env.STARTGG_CACHE_DIR ||
  path.join(os.tmpdir(), "fgctp_startgg_socials");
const CACHE_PATH = path.join(CACHE_DIR, "startgg_socials_cache.json");

const FETCH_CACHE_DIR =
  process.env.STARTGG_FETCH_CACHE_DIR ||
  path.join(os.tmpdir(), "fgctp_eleventy_fetch");
const RANKINGS_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1otrfs8HN3Shq6U2-qrc4GDxTI4ragnqwbTjweecE12Q/gviz/tq?tqx=out:csv&gid=1862929315&range=A:Z";

const STARTGG_SLUG_FIELDS = [
  "Slug",
  "Player Slug",
  "Player ID",
  "startgg_slug",
  "StartGG Slug",
  "StartGG_ID",
  "StartGG",
  "StartGG URL",
  "Start.gg",
  "Start.gg URL",
  "startgg",
  "Profile",
  "Profile URL",
  "Link",
];

const TWITTER_FIELDS = ["Twitter", "Twitter Handle", "Twitter URL"];
const TWITCH_FIELDS = ["Twitch", "Twitch Handle", "Twitch URL"];
const DISCORD_FIELDS = ["Discord", "Discord Handle", "Discord URL", "Discord Link"];

const MAX_FETCH_PER_RUN =
  Number.isFinite(Number(process.env.STARTGG_MAX_FETCH_PER_RUN))
    ? Number(process.env.STARTGG_MAX_FETCH_PER_RUN)
    : 40;

function normalizeSlugKey(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim().toLowerCase();
  return normalized ? normalized : null;
}

function createRequestedSlugSet(rawValues) {
  if (!rawValues) return null;
  const values = Array.isArray(rawValues)
    ? rawValues
    : String(rawValues)
        .split(/[,\s]+/)
        .filter(Boolean);

  const normalized = values
    .map(normalizeSlugKey)
    .filter(Boolean);

  return normalized.length > 0 ? new Set(normalized) : null;
}

function parseCSV(csvText) {
  // Manual CSV parsing to avoid Papa Parse browser API issues
  if (!csvText || typeof csvText !== 'string') {
    console.error('[startggSocials] Invalid CSV text received:', typeof csvText);
    return [];
  }

  // Normalize line endings so CR-only files (Google export edge case) still split
  const normalizedCsv = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalizedCsv.trim().split('\n');
  if (lines.length < 2) {
    console.warn('[startggSocials] CSV has less than 2 lines');
    return [];
  }

  // Parse header row
  const headerLine = lines[0];
  const headers = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < headerLine.length; i++) {
    const char = headerLine[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      const header = current.trim().replace(/^"|"$/g, '');
      // Map empty first column to "Rank"
      headers.push(header === '' ? 'Rank' : header);
      current = '';
    } else {
      current += char;
    }
  }
  const lastHeader = current.trim().replace(/^"|"$/g, '');
  headers.push(lastHeader === '' ? 'Rank' : lastHeader);

  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Handle quoted fields
    const values = [];
    current = '';
    inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim().replace(/^"|"$/g, ''));

    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row);
  }

  return rows;
}

function fallbackSlugify(str) {
  return (str || "")
    .toString()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['\"\u2018\u2019\u201c\u201d]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extractSlugFromUrl(url) {
  if (!url) return null;
  try {
    const normalized = String(url).trim();
    if (!normalized) return null;

    const parsed = new URL(normalized);
    const parts = parsed.pathname.split("/").filter(Boolean);

    const typeIndex = parts.findIndex((part) => part === "user" || part === "player");
    if (typeIndex >= 0 && parts[typeIndex + 1]) {
      return parts[typeIndex + 1].toLowerCase();
    }

    if (parts.length === 1) {
      return parts[0].toLowerCase();
    }
  } catch {
    // Ignore malformed URLs
  }

  return null;
}

function normalizeFieldKey(key) {
  if (key === undefined || key === null) return null;
  return String(key)
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, "");
}

function getRowValue(row, field) {
  if (!row) return null;
  if (Object.prototype.hasOwnProperty.call(row, field)) {
    return row[field];
  }
  const normalizedTarget = normalizeFieldKey(field);
  if (!normalizedTarget) return null;
  for (const key of Object.keys(row)) {
    const normalizedKey = normalizeFieldKey(key);
    if (normalizedKey && normalizedKey === normalizedTarget) {
      return row[key];
    }
  }
  return null;
}

function readFirstField(row, fields) {
  if (!row) return null;
  for (const field of fields) {
    const value = getRowValue(row, field);
    if (value !== undefined && value !== null) {
      const trimmed = String(value).trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
}

function extractPlayerSlug(row) {
  const candidate = readFirstField(row, STARTGG_SLUG_FIELDS);
  if (!candidate) return null;

  if (/^https?:\/\//i.test(candidate)) {
    const extracted = extractSlugFromUrl(candidate);
    return extracted ? extracted.toLowerCase() : null;
  }

  return candidate.toLowerCase();
}

async function ensureDirectory(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    if (error.code !== "EEXIST") {
      throw error;
    }
  }
}

async function loadCache() {
  try {
    const raw = await fs.readFile(CACHE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return {
        players: parsed.players || {},
        lastUpdated: parsed.lastUpdated || null,
      };
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn("[startggSocials] Unable to load cache", error.message);
    }
  }
  return { players: {}, lastUpdated: null };
}

// Check if player data is stale (>30 days old)
function isPlayerDataStale(playerData) {
  if (!playerData || !playerData.lastFetched) {
    return true; // No data or no timestamp = stale
  }
  const lastFetched = new Date(playerData.lastFetched);
  const now = new Date();
  const daysSinceUpdate = (now - lastFetched) / (1000 * 60 * 60 * 24);
  return daysSinceUpdate > 30;
}

async function saveCache(payload, previous) {
  try {
    await ensureDirectory(CACHE_DIR);
    const existing = previous ?? (await loadCache());
    const nextString = JSON.stringify(payload, null, 2);
    const existingString = JSON.stringify(existing, null, 2);
    if (nextString === existingString) {
      return;
    }
    await fs.writeFile(CACHE_PATH, nextString, "utf8");
    console.log("[startggSocials] Cache updated");
  } catch (error) {
    console.warn("[startggSocials] Failed to write cache", error.message);
  }
}

function normalizeSocialUrl(kind, value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (kind === "twitter" || kind === "x") {
    if (/^(?:www\.)?(?:twitter\.com|x\.com)\//i.test(trimmed)) {
      return `https://${trimmed.replace(/^https?:\/\//i, "").replace(/^www\./i, "")}`;
    }
    const handle = trimmed.replace(/^@/, "").replace(/^(?:twitter\.com|x\.com)\//i, "");
    return handle ? `https://x.com/${handle}` : null;
  }

  if (kind === "twitch") {
    if (/^(?:www\.)?twitch\.tv\//i.test(trimmed)) {
      return `https://${trimmed.replace(/^https?:\/\//i, "").replace(/^www\./i, "")}`;
    }
    const handle = trimmed.replace(/^@/, "").replace(/^twitch\.tv\//i, "");
    return handle ? `https://twitch.tv/${handle}` : null;
  }

  if (kind === "discord") {
    if (/^discord\.(gg|com)/i.test(trimmed)) {
      return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    }
    return null;
  }

  return trimmed;
}

function normalizeFromRow(row, fields, kind) {
  const value = readFirstField(row, fields);
  return normalizeSocialUrl(kind, value);
}

module.exports = async function (options = {}) {
  const rawRequested =
    (options && options.requestedSlugs) ||
    (options && options.requested) ||
    (options && options.slugs) ||
    null;
  const requestedSlugs = createRequestedSlugSet(rawRequested);

  if (DISABLE_STARTGG_FETCH) {
    console.log("[startggSocials] Fetching disabled via DISABLE_STARTGG_FETCH");
    return loadCache();
  }

  const cached = await loadCache();

  const apiToken = process.env.STARTGG_API_TOKEN;
  if (!apiToken) {
    console.warn("[startggSocials] STARTGG_API_TOKEN missing; returning cached data");
    return cached;
  }

  if (requestedSlugs && requestedSlugs.size > 0) {
    console.log(`[startggSocials] Requested slug filter active (${requestedSlugs.size} players)`);
  }

  try {
    // ---
    // CHANGE 1: Removed cachebuster from the URL
    // ---
    const rankingsUrl = RANKINGS_SHEET_URL;

    console.log("[startggSocials] Fetching ranking sheet for StartGG slugs...");
    await ensureDirectory(FETCH_CACHE_DIR);

    let csvText = await EleventyFetch(rankingsUrl, {
      directory: FETCH_CACHE_DIR,
      duration: "1d",
      type: "text",
      fetchOptions: {
        timeout: 15000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      },
    });

    // Handle case where EleventyFetch returns object instead of string
    if (typeof csvText === 'object' && csvText !== null) {
      if (Buffer.isBuffer(csvText)) {
        csvText = csvText.toString("utf8");
      } else {
      // Try to extract string from common object formats
      if (csvText.data && typeof csvText.data === 'string') {
        csvText = csvText.data;
      } else if (csvText.text && typeof csvText.text === 'string') {
        csvText = csvText.text;
      } else if (csvText.body && typeof csvText.body === 'string') {
        csvText = csvText.body;
      } else {
        // Try JSON.stringify as last resort
        csvText = JSON.stringify(csvText);
      }
    }
    }

    // Ensure csvText is actually a string
    if (typeof csvText !== 'string') {
      throw new Error(`Could not extract string from EleventyFetch result, got ${typeof csvText}`);
    }

    const rows = parseCSV(csvText).filter(
      (row) => row && (row.Player || row["Player Slug"] || row.Slug)
    );

    const rankingSlugMap = new Map();
    const startggSlugToRanking = new Map();
    let missingSlugCount = 0;

    rows.forEach((row) => {
      const playerName = row.Player ? String(row.Player).trim() : "";
      const rankingSlug = playerName ? fallbackSlugify(playerName) : null;
      const startggSlugRaw = extractPlayerSlug(row);
      const startggSlug = startggSlugRaw ? String(startggSlugRaw).trim().toLowerCase() : null;

      if (!startggSlug) {
        missingSlugCount++;
        return;
      }

      const fetchKey = startggSlug.toLowerCase();

      if (rankingSlug) {
        rankingSlugMap.set(rankingSlug, {
          rankingSlug,
          playerName,
          startggSlug: fetchKey,
          fallbackTwitter: normalizeFromRow(row, TWITTER_FIELDS, "twitter"),
          fallbackTwitch: normalizeFromRow(row, TWITCH_FIELDS, "twitch"),
          fallbackDiscord: normalizeFromRow(row, DISCORD_FIELDS, "discord"),
        });
      }

      if (fetchKey) {
        if (!startggSlugToRanking.has(fetchKey)) {
          startggSlugToRanking.set(fetchKey, new Set());
        }
        if (rankingSlug) {
          startggSlugToRanking.get(fetchKey).add(rankingSlug);
        }
      }
    });

    if (missingSlugCount > 0) {
      console.log(
        `[startggSocials] Skipped ${missingSlugCount} players without StartGG IDs`
      );
    }

    const uniqueStartggSlugs = Array.from(startggSlugToRanking.keys());
    if (uniqueStartggSlugs.length === 0) {
      console.warn("[startggSocials] No slugs found; returning cached data");
      return cached;
    }

    // Determine which players need fetching (stale or missing data)
    let candidateSlugs;
    if (Array.isArray(priorityPlayers) && priorityPlayers.length > 0) {
      candidateSlugs = priorityPlayers
        .map((slug) => String(slug || "").trim().toLowerCase())
        .filter(Boolean);
      console.log(`[startggSocials] Using priority list (${candidateSlugs.length} players)`);
    } else {
      // Fetch ALL ranked players (no limit)
      candidateSlugs = uniqueStartggSlugs;
      console.log(`[startggSocials] Processing all ${candidateSlugs.length} ranked players`);
    }

    if (requestedSlugs && requestedSlugs.size > 0) {
      const filteredSet = new Set();
      candidateSlugs.forEach((slug) => {
        if (requestedSlugs.has(slug)) {
          filteredSet.add(slug);
        }
      });
      requestedSlugs.forEach((slug) => {
        if (!filteredSet.has(slug)) {
          filteredSet.add(slug);
        }
      });
      const filteredList = Array.from(filteredSet);
      if (filteredList.length === 0) {
        console.warn("[startggSocials] Requested slugs did not match any known players; returning cached data");
        return cached;
      }
      if (filteredList.length !== candidateSlugs.length) {
        console.log(
          `[startggSocials] Candidate list filtered from ${candidateSlugs.length} to ${filteredList.length} requested players`
        );
      }
      candidateSlugs = filteredList;
    }

    const staleCandidates = candidateSlugs
      .map((slug) => {
        const cachedData = cached.players[slug];
        const lastFetched = cachedData?.lastFetched
          ? new Date(cachedData.lastFetched)
          : null;
        const ageMs = lastFetched ? Date.now() - lastFetched.getTime() : Number.POSITIVE_INFINITY;
        return { slug, cachedData, ageMs };
      })
      .filter(({ cachedData }) => isPlayerDataStale(cachedData))
      .sort((a, b) => b.ageMs - a.ageMs);

    const playersToFetch = staleCandidates
      .slice(0, Math.max(MAX_FETCH_PER_RUN, 1))
      .map(({ slug }) => slug);

    console.log(
      `[startggSocials] ${staleCandidates.length} players need updating (missing or >30 days old)`
    );
    console.log(
      `[startggSocials] ${candidateSlugs.length - staleCandidates.length} players using cached data`
    );

    if (staleCandidates.length > playersToFetch.length) {
      console.log(
        `[startggSocials] Limiting to ${playersToFetch.length} players this run (env MAX_FETCH_PER_RUN=${MAX_FETCH_PER_RUN})`
      );
    }

    if (playersToFetch.length === 0) {
      console.log("[startggSocials] All player data is fresh; returning cached data");
      return cached;
    }

    console.log(
      `[startggSocials] Fetching ${playersToFetch.length} player socials from StartGG`
    );
    const fetchedSocials = await batchGetUserSocials(playersToFetch);
    if (!fetchedSocials || Object.keys(fetchedSocials).length === 0) {
      console.warn("[startggSocials] No socials returned by StartGG; returning cached data");
      return cached;
    }

    // Start with cached players to preserve fresh data
    const players = { ...cached.players };
    const now = new Date().toISOString();

    const assignPlayer = (key, payload) => {
      if (!key) return;
      const normalizedKey = String(key).toLowerCase();
      players[normalizedKey] = { ...payload };
    };

    Object.entries(fetchedSocials).forEach(([startggSlug, socials]) => {
      const key = startggSlug.toLowerCase();
      const rankingSlugs = startggSlugToRanking.get(key);
      const payload = {
        startggSlug,
        twitter: normalizeSocialUrl("twitter", socials.twitter),
        twitch: normalizeSocialUrl("twitch", socials.twitch),
        discord: normalizeSocialUrl("discord", socials.discord),
        lastFetched: now, // Add timestamp
      };

      if (socials.discord && !payload.discord) {
        payload.discordUsername = socials.discord;
      }

      if (rankingSlugs && rankingSlugs.size > 0) {
        rankingSlugs.forEach((rankingSlug) => {
          assignPlayer(rankingSlug, payload);
        });
      }

      assignPlayer(startggSlug, payload);
    });

    const fallbackNowPayload = {
      lastFetched: now,
    };

    playersToFetch.forEach((slug) => {
      const normalized = String(slug).toLowerCase();
      if (!players[normalized] || !players[normalized].lastFetched || players[normalized].lastFetched !== now) {
        const payload = {
          ...fallbackNowPayload,
          startggSlug: players[normalized]?.startggSlug || slug,
        };
        assignPlayer(normalized, { ...players[normalized], ...payload });
      }

      const rankingSlugs = startggSlugToRanking.get(normalized);
      if (rankingSlugs && rankingSlugs.size > 0) {
        rankingSlugs.forEach((rankingSlug) => {
          const key = rankingSlug.toLowerCase();
          const existing = players[key] || {};
          players[key] = {
            ...existing,
            startggSlug: existing.startggSlug || slug,
            lastFetched: existing.lastFetched || now,
          };
        });
      }
    });

    // Include fallback socials from sheet if available and StartGG did not return anything
    rankingSlugMap.forEach((details, rankingSlug) => {
      const key = rankingSlug.toLowerCase();
      if (!players[key]) {
        const fallback = {
          startggSlug: details.startggSlug || rankingSlug,
          twitter: details.fallbackTwitter,
          twitch: details.fallbackTwitch,
          discord: details.fallbackDiscord,
          lastFetched: now, // Add timestamp for fallback data too
        };

        Object.keys(fallback).forEach((field) => {
          if (fallback[field] === undefined || fallback[field] === "") {
            delete fallback[field];
          }
        });

        if (
          fallback.twitter ||
          fallback.twitch ||
          fallback.discord
        ) {
          players[key] = fallback;
        }
      }
    });

    const result = {
      players,
      lastUpdated: new Date().toISOString(),
    };

    await saveCache(result, cached);
    return result;
  } catch (error) {
    console.error("[startggSocials] Failed to fetch socials", error.message);
    if (cached && Object.keys(cached.players || {}).length > 0) {
      console.log("[startggSocials] Falling back to cached data");
      return cached;
    }
    return { players: {}, lastUpdated: null };
  }
};
