"use strict";

const fs = require("fs");
const path = require("path");
const { DateTime } = require("luxon");
const archive = require("./upcoming-tournaments_archive.json");

const OVERRIDES_PATH = path.join(__dirname, "upcomingTournamentsOverrides.json");
const TIER_SORT_ORDER = ["S+", "S", "A", "B"];

function readJsonFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf8");
      if (raw.trim()) {
        return JSON.parse(raw);
      }
    }
  } catch (error) {
    console.warn(`[allUpcomingTournaments] Failed to read ${filePath}:`, error.message);
  }
  return {};
}

function normalizeOverrides(rawOverrides) {
  const excludedSlugs = new Set();
  const normalized = {};
  Object.entries(rawOverrides || {}).forEach(([slug, value]) => {
    if (!value || typeof value !== "object") return;
    if (value.excludeFromSite) {
      excludedSlugs.add(slug);
      return;
    }
    const { manualOnly, excludeFromSite, ...rest } = value;
    normalized[slug] = rest;
  });
  return { normalized, excludedSlugs };
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

function parseDateString(value) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/\[.*?\]/g, "");

  const rangeMatch = normalized.match(
    /^([A-Za-z]+)\s+(\d{1,2})(?:\s*-\s*[A-Za-z]*\s*\d{1,2})?,\s*(\d{4})$/
  );
  if (rangeMatch) {
    const [, month, startDay, year] = rangeMatch;
    const reconstructed = `${month} ${startDay}, ${year}`;
    const dt = DateTime.fromFormat(reconstructed, "MMM d, yyyy", { zone: "utc" });
    if (dt.isValid) return dt;
  }

  const formats = ["MMM d, yyyy", "MMMM d, yyyy", "MMM d", "MMMM d"];
  for (const format of formats) {
    const dt = DateTime.fromFormat(normalized, format, { zone: "utc" });
    if (dt.isValid) {
      return dt.year ? dt : dt.set({ year: DateTime.utc().year });
    }
  }
  return null;
}

function deriveStartEndFromDates(dates) {
  const normalized = typeof dates === "string" ? dates.trim() : "";
  if (!normalized) return { start: null, end: null };
  const cleaned = normalized.replace(/\[.*?\]/g, "");
  const yearMatch = cleaned.match(/(\d{4})$/);
  const year = yearMatch ? yearMatch[1] : String(DateTime.utc().year);
  const body = yearMatch ? cleaned.slice(0, yearMatch.index).trim().replace(/[, ]+$/, "") : cleaned;
  const parts = body.split("-").map((part) => part.trim()).filter(Boolean);
  const startPart = parts[0] || body;
  const endPart = parts.length > 1 ? parts[parts.length - 1] : startPart;

  const parseMonthDay = (part, fallbackMonth) => {
    if (!part) return null;
    const tokens = part.split(/\s+/).filter(Boolean);
    let monthToken;
    let dayToken;
    if (tokens.length === 1) {
      if (/^\d+$/.test(tokens[0])) {
        if (!fallbackMonth) return null;
        monthToken = fallbackMonth;
        dayToken = tokens[0];
      } else {
        monthToken = tokens[0];
        dayToken = "1";
      }
    } else {
      monthToken = tokens[0];
      dayToken = tokens[1];
    }
    return { month: monthToken, day: dayToken };
  };

  const startMD = parseMonthDay(startPart, null);
  const endMD = parseMonthDay(endPart, startMD ? startMD.month : null);

  const toISO = (md) => {
    if (!md) return null;
    const patterns = ["MMM d, yyyy", "MMMM d, yyyy"];
    for (const pattern of patterns) {
      const dt = DateTime.fromFormat(`${md.month} ${md.day}, ${year}`, pattern, { zone: "utc" });
      if (dt.isValid) return dt.toISODate();
    }
    return null;
  };

  const startISO = toISO(startMD);
  let endISO = toISO(endMD);

  if (!endISO && startISO) {
    endISO = startISO;
  }

  return { start: startISO, end: endISO };
}

function getTierSortIndex(value) {
  if (!value) return TIER_SORT_ORDER.length + 1;
  const normalized = String(value).trim().toUpperCase();
  const index = TIER_SORT_ORDER.indexOf(normalized);
  return index === -1 ? TIER_SORT_ORDER.length : index;
}

function compareTiers(entryA, entryB) {
  return getTierSortIndex(entryA?.tier) - getTierSortIndex(entryB?.tier);
}

function ensureDerivedDates(entry) {
  if (!entry || typeof entry !== "object") return entry;
  if (typeof entry.excludeFromSite !== "boolean") {
    entry.excludeFromSite = false;
  }
  if (!entry.startDate || !entry.endDate) {
    const derived = deriveStartEndFromDates(entry.dates);
    if (!entry.startDate && derived.start) entry.startDate = derived.start;
    if (!entry.endDate && derived.end) entry.endDate = derived.end;
  }
  if (entry.startDate && !entry.startAt) {
    const dt = DateTime.fromISO(entry.startDate, { zone: "utc" });
    if (dt.isValid) {
      entry.startAt = Math.floor(dt.toSeconds());
    }
  }
  if (entry.endDate && !entry.endAt) {
    const dt = DateTime.fromISO(entry.endDate, { zone: "utc" });
    if (dt.isValid) {
      entry.endAt = Math.floor(dt.endOf("day").toSeconds());
    }
  }
  return entry;
}

function mergeOverrides(base, overrides) {
  const result = { ...base };
  Object.entries(overrides || {}).forEach(([slug, override]) => {
    const merged = {
      ...(result[slug] || {}),
      ...override,
    };
    ensureDerivedDates(merged);
    result[slug] = merged;
  });
  return result;
}

function sortObjectByStartDate(obj) {
  if (!obj || typeof obj !== "object") return {};
  const entries = Object.entries(obj);
  entries.sort(([slugA, dataA], [slugB, dataB]) => {
    ensureDerivedDates(dataA);
    ensureDerivedDates(dataB);
    let timeA = getStartTimestamp(dataA);
    let timeB = getStartTimestamp(dataB);
    if (!Number.isFinite(timeA) && dataA?.dates) {
      const parsed = parseDateString(dataA.dates);
      if (parsed?.isValid) timeA = parsed.toSeconds();
    }
    if (!Number.isFinite(timeB) && dataB?.dates) {
      const parsed = parseDateString(dataB.dates);
      if (parsed?.isValid) timeB = parsed.toSeconds();
    }
    const sameStartDate =
      dataA?.startDate && dataB?.startDate && dataA.startDate === dataB.startDate;

    if (!sameStartDate && timeA !== timeB) {
      return timeA - timeB;
    }

    if (sameStartDate) {
      const tierComparison = compareTiers(dataA, dataB);
      if (tierComparison !== 0) {
        return tierComparison;
      }
    }

    const nameA = (dataA && dataA.name) || slugA;
    const nameB = (dataB && dataB.name) || slugB;
    return String(nameA).localeCompare(String(nameB));
  });
  return Object.fromEntries(entries);
}

module.exports = async function () {
  const rawOverrides = readJsonFile(OVERRIDES_PATH);
  const { normalized: overrides, excludedSlugs } = normalizeOverrides(rawOverrides);

  // Merge strictly from overrides and archive (nothing auto-generated hits the site)
  let tournaments = mergeOverrides({}, overrides);
  tournaments = mergeOverrides(tournaments, archive);

  excludedSlugs.forEach((slug) => {
    if (tournaments[slug]) {
      delete tournaments[slug];
    }
  });

  const sorted = sortObjectByStartDate(tournaments);
  Object.values(sorted).forEach(ensureDerivedDates);

  if (process.env.ELEVENTY_ENV === "development") {
    const validEntries = Object.entries(sorted).filter(([, tournament]) => {
      return tournament.tier !== undefined && !tournament.isArchived;
    });
    return Object.fromEntries(validEntries.slice(0, 6));
  }

  return sorted;
};