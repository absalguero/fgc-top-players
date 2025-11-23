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
    const raw = getRowValue(row, field);
    if (raw === undefined || raw === null) continue;
    const trimmed = String(raw).trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function normalizeTwitterLink(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const handle = trimmed.replace(/^@/, "");
  return handle ? `https://x.com/${handle}` : null;
}

function normalizeTwitchLink(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const handle = trimmed.replace(/^@/, "");
  return handle ? `https://twitch.tv/${handle}` : null;
}

function normalizeDiscordLink(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  // If it's a full URL, return as-is
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  // If it starts with discord.gg or discord.com, prepend https://
  if (/^discord\.(gg|com)/i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  // If it's just a username (no URL), return it as-is for display
  // Discord usernames can't be linked, but we still want to show them
  return trimmed;
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

function collectSlugCandidates(row, fallbackSlug) {
  const candidates = new Set();

  if (fallbackSlug) {
    candidates.add(String(fallbackSlug).toLowerCase());
  }

  const rawCandidate = readFirstField(row, STARTGG_SLUG_FIELDS);
  if (rawCandidate) {
    if (/^https?:\/\//i.test(rawCandidate)) {
      const extracted = extractSlugFromUrl(rawCandidate);
      if (extracted) candidates.add(extracted.toLowerCase());
    } else {
      candidates.add(rawCandidate.toLowerCase());
    }
  }

  return Array.from(candidates);
}

function findStartggEntry(row, fallbackSlug, startggSocials) {
  if (!startggSocials || !startggSocials.players) {
    return null;
  }

  const players = startggSocials.players;
  const candidates = collectSlugCandidates(row, fallbackSlug);

  for (const candidate of candidates) {
    if (players[candidate]) {
      return players[candidate];
    }
    if (players[String(candidate).toLowerCase()]) {
      return players[String(candidate).toLowerCase()];
    }
  }

  return null;
}

function buildPlayerSocials(row, fallbackSlug, startggSocials) {
  const entry = findStartggEntry(row, fallbackSlug, startggSocials);

  const fallbackTwitter = normalizeTwitterLink(readFirstField(row, TWITTER_FIELDS));
  const fallbackTwitch = normalizeTwitchLink(readFirstField(row, TWITCH_FIELDS));
  const fallbackDiscord = normalizeDiscordLink(readFirstField(row, DISCORD_FIELDS));

  const socials = {};
  const twitter = normalizeTwitterLink(entry?.twitter) || fallbackTwitter;
  if (twitter) socials.twitter = twitter;

  const twitch = normalizeTwitchLink(entry?.twitch) || fallbackTwitch;
  if (twitch) socials.twitch = twitch;

  const discord = normalizeDiscordLink(entry?.discord) || normalizeDiscordLink(entry?.discordUsername) || fallbackDiscord;
  if (discord) socials.discord = discord;

  return {
    socials,
    startggSlug: entry?.startggSlug || null,
  };
}

module.exports = {
  buildPlayerSocials,
  findStartggEntry,
  normalizeTwitterLink,
  normalizeTwitchLink,
  normalizeDiscordLink,
  extractSlugFromUrl,
};
