"use strict";

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { DateTime } = require("luxon");

const DATA_DIR = path.join(__dirname, "..", "_data");
const GENERATED_PATH = path.join(DATA_DIR, "upcomingTournamentsGenerated.json");
const OVERRIDES_PATH = path.join(DATA_DIR, "upcomingTournamentsOverrides.json");
const ARCHIVE_PATH = path.join(DATA_DIR, "upcoming-tournaments_archive.json");

const { collectUpcomingForPlayers } = require(path.join(DATA_DIR, "lib", "startggUpcoming"));
const loadRankings = require(path.join(DATA_DIR, "rankings.js"));

const TIER_SORT_ORDER = ["S+", "S", "A", "B"];

function readJsonFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf8");
      if (raw.trim()) return JSON.parse(raw);
    }
  } catch (err) {
    console.warn(`[scoutUpcoming] Failed to read ${filePath}:`, err.message);
  }
  return {};
}

function normalizeSlug(slug) {
  if (!slug) return "";
  return String(slug)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ""); // Strips hyphens, underscores, spaces for loose comparison
}

function buildTop200Players(rankings) {
  if (!rankings || !Array.isArray(rankings.players)) return [];
  return rankings.players
    .map((row, idx) => {
      if (!row || !row.Player) return null;
      const rawSlug =
        row["Player ID"] ||
        row["Slug"] ||
        row["StartGG Slug"] ||
        row["startgg_slug"] ||
        row["StartGG"] ||
        null;
      if (!rawSlug) return null;

      const parsedRank = Number(String(row.Rank || "").replace(/[^0-9.-]/g, ""));
      const rank = Number.isFinite(parsedRank) && parsedRank > 0 ? parsedRank : idx + 1;

      return {
        name: String(row.Player).trim(),
        startggSlug: String(rawSlug).trim(),
        rank,
      };
    })
    .filter((p) => p && p.rank <= 200);
}

function getTierSortIndex(value) {
  if (!value) return TIER_SORT_ORDER.length + 1;
  const normalized = String(value).trim().toUpperCase();
  const index = TIER_SORT_ORDER.indexOf(normalized);
  return index === -1 ? TIER_SORT_ORDER.length : index;
}

function getStartTimestamp(data) {
  if (!data || typeof data !== "object") return Number.POSITIVE_INFINITY;
  if (Number.isFinite(data.startAt)) return Number(data.startAt);
  if (data.startDate) {
    const dt = DateTime.fromISO(String(data.startDate), { zone: "utc" });
    if (dt.isValid) return dt.toSeconds();
  }
  return Number.POSITIVE_INFINITY;
}

async function runScout() {
  const includeKnown = process.argv.includes("--all");
  console.log("🔍 Scouting start.gg for upcoming offline SF6 events (Top 200 players)...");

  const rankingsData = await loadRankings();
  const players = buildTop200Players(rankingsData);
  console.log(`✅ Loaded ${players.length} ranked players (Top 200 with start.gg IDs).`);

  if (!players.length) {
    console.warn("⚠️ No players found to query.");
    return;
  }

  const { tournamentsBySlug } = await collectUpcomingForPlayers(players, {
    topN: 200,
    offlineOnly: true,
  });

  const rawDiscovered = tournamentsBySlug || {};
  const overrides = readJsonFile(OVERRIDES_PATH);
  const archive = readJsonFile(ARCHIVE_PATH);

  // Build normalized lookup sets for overrides and archive keys
  const excludedNormalized = new Set([
    ...Object.keys(overrides).map(normalizeSlug),
    ...Object.keys(archive).map(normalizeSlug),
  ]);

  const entries = Object.entries(rawDiscovered).filter(([slug, data]) => {
    if (includeKnown) return true;
    
    const cleanSlug = data.slug || slug;
    const normSlug = normalizeSlug(cleanSlug);
    const normName = normalizeSlug(data.name);

    // Filter out if either the slug or normalized tournament name matches an override/archive entry
    if (excludedNormalized.has(normSlug) || (normName && excludedNormalized.has(normName))) {
      return false;
    }
    return true;
  });

  // Sort chronologically by start date, then by tier (S+ -> B), then alphabetically
  entries.sort(([slugA, a], [slugB, b]) => {
    const timeA = getStartTimestamp(a);
    const timeB = getStartTimestamp(b);
    if (timeA !== timeB) return timeA - timeB;

    const tierDiff = getTierSortIndex(a?.tier) - getTierSortIndex(b?.tier);
    if (tierDiff !== 0) return tierDiff;

    return String(a?.name || slugA).localeCompare(String(b?.name || slugB));
  });

  // Format with name, date, url, tier, and notablePlayers
  const output = {};
  for (const [slug, data] of entries) {
    const cleanSlug = data.slug || slug;
    const url =
      data.startggUrl ||
      data.url ||
      data.website ||
      `https://www.start.gg/tournament/${cleanSlug}/details`;

    output[slug] = {
      name: data.name || cleanSlug,
      date: data.dates || data.startDate || "TBD",
      url,
      tier: data.tier || "B",
      notablePlayers: Array.isArray(data.notablePlayers) ? data.notablePlayers : [],
    };
  }

  await fs.promises.writeFile(GENERATED_PATH, JSON.stringify(output, null, 2), "utf8");
  console.log(`🎯 Wrote ${Object.keys(output).length} new unreviewed events to _data/upcomingTournamentsGenerated.json`);
}

runScout().catch((err) => {
  console.error("❌ Scout script failed:", err);
  process.exit(1);
});