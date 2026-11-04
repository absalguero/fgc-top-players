"use strict";

const slugify = require("slugify");
const { DateTime } = require("luxon");
const getStartggSocials = require("./startggSocials.js");
const { buildPlayerSocials, extractSlugFromUrl } = require("./lib/playerSocials.js");
const { collectUpcomingForPlayers } = require("./lib/startggUpcoming");
const upcomingOverrides = require("./upcomingTournamentsOverrides.json");

// --- Config & Constants ---
const STARTGG_SLUG_FIELDS = [
  "Slug", "Player Slug", "Player ID", "startgg_slug", "StartGG Slug", "StartGG_ID",
  "StartGG", "StartGG URL", "Start.gg", "Start.gg URL", "startgg", "Profile", "Profile URL", "Link"
];

const SIX_MONTH_CHANGE_FIELDS = [
  "Rating Change 6M", "6M Rating Change", "6M Rank Change", "Rank Change 6M", "6M Change", "6M"
];

const EXCLUDED_TOURNAMENT_SLUGS = new Set(
  Object.entries(upcomingOverrides || {})
    .filter(([, v]) => v && v.excludeFromSite)
    .map(([k]) => k)
);

const TDR_MULTIPLIERS = { 'S+': 7.0, 'S': 5.0, 'A': 2.5, 'B': 1.0 };
const PF_TIER_WEIGHTS = { 'S+': 1.0, 'S': 0.95, 'A': 0.85, 'B': 0.75 };

const TIER_POINTS = {
  'S+': { victory: 7.0, top3: 3.5, top8: 1.75, top16: 0.9 },
  'S':  { victory: 5.0, top3: 2.5, top8: 1.25, top16: 0.6 },
  'A':  { victory: 2.5, top3: 1.25, top8: 0.6, top16: 0.3 },
  'B':  { victory: 1.0, top3: 0.5, top8: 0.25, top16: 0.1 }
};

// Official Spreadsheet Base Points (Placements 1 to 50)
const BASE_POINTS_BY_FINISH = [
  0,
  1000, 650, 450, 350, 250, 200, 180, 160, 140, 120, // 1 - 10
  100,  90,  80,  70,  60,  50,  48,  46,  44,  42,  // 11 - 20
  40,   38,  36,  34,  32,  30,  28,  26,  24,  22,  // 21 - 30
  20,   19,  18,  17,  16,  15,  14,  13,  12,  11,  // 31 - 40
  10,   9,   8,   7,   6,   5,   4,   3,   2,   1    // 41 - 50
];

const EVENT_CAP = 5;
const TRACKING_EPOCH_ISO = "2025-11-10"; // Official start date for PR & TR tracking

const TOOLTIP_TEXT = {
  FGPI: "Fighting Game Performance Index", TDR: "Tournament Difficulty Rating", PF: "Performance Floor",
  MS: "Momentum Score", AF12: "Avg. Finish (12 mo.)", AF6: "Avg. Finish (6 mo.)",
  AFM12: "Avg. Finish at Majors (12 mo.)", AFM6: "Avg. Finish at Majors (6 mo.)",
  APP: "Avg. Placement Percentile", APM: "Avg. Percentile at Majors", V: "Victories",
  T3: "Top 3 Finishes", T8: "Top 8 Finishes", T16: "Top 16 Finishes", PR: "Peak Rank", TR: "Weeks In Top 40"
};

// --- Helpers ---
const getAverage = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
const normalizeSlugValue = (v) => v ? String(v).trim().toLowerCase() : null;
const normalizeFieldKey = (k) => k ? String(k).normalize("NFKC").trim().toLowerCase().replace(/[^a-z0-9]+/g, "") : null;
const normalizePlayerKey = (name) => String(name || "").normalize("NFKC").trim().toLowerCase();

function getRowValue(row, field) {
  if (!row) return null;
  if (Object.prototype.hasOwnProperty.call(row, field)) return row[field];
  const target = normalizeFieldKey(field);
  if (!target) return null;
  for (const k of Object.keys(row)) if (normalizeFieldKey(k) === target) return row[k];
  return null;
}

function parseSheetNumber(val) {
  if (val === null || val === undefined) return NaN;
  const cleaned = String(val)
    .replace(/[\u2212\u2013\u2014]/g, "-")
    .replace(/[,\s+#]/g, "")
    .trim();
  if (cleaned === "" || cleaned === "-" || /^n\/?a$/i.test(cleaned)) return NaN;
  return Number(cleaned);
}

function getPlayerRankFromRow(row, fallbackIndex) {
  const candidates = [
    getRowValue(row, "Rank"),
    row?.Rank,
    row?.rank,
    row?._empty_0,
    row ? Object.values(row)[0] : null
  ];
  for (const c of candidates) {
    const n = parseSheetNumber(c);
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  return fallbackIndex + 1;
}

function getSheet6MChange(row) {
  for (const f of SIX_MONTH_CHANGE_FIELDS) {
    const v = getRowValue(row, f);
    const num = parseSheetNumber(v);
    if (Number.isFinite(num)) return num;
  }
  return null;
}

function getStartggSlugFromRow(row) {
  for (const field of STARTGG_SLUG_FIELDS) {
    const val = getRowValue(row, field);
    const raw = normalizeSlugValue(val);
    if (raw) return /^https?:\/\//i.test(raw) ? (extractSlugFromUrl(raw)?.toLowerCase() || null) : raw;
  }
  return null;
}

const createSafeSlug = (name) => {
  const s = String(name || '').replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F()]/gu, '').trim();
  return slugify(s, { lower: true, strict: false, locale: 'en', remove: /[*+~.()'"!:@]/g });
};

const getCharacterFileName = (c) => {
  if (!c) return '';
  const primary = String(c).split(/[\/,&]/)[0].trim();
  const slugged = primary.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
  return slugged === 'a-k-i' ? 'aki' : slugged;
};
const getTierName = (t) => t?.startsWith('S') ? 'Major' : (t === 'A' ? 'National' : (t === 'B' ? 'Regional' : 'Event'));

function deriveStartEndFromDates(dates) {
  const norm = typeof dates === "string" ? dates.trim() : "";
  if (!norm) return { start: null, end: null };
  const year = (norm.match(/(\d{4})$/) || [])[1] || String(DateTime.utc().year);
  const parts = norm.replace(/\[.*?\]/g, "").replace(/(\d{4})$/, "").trim().replace(/[, ]+$/, "").split("-");
  const parse = (p, fb) => {
    if (!p) return null;
    const t = p.trim().split(/\s+/).filter(Boolean);
    return t.length === 1 ? (/^\d+$/.test(t[0]) ? { m: fb, d: t[0] } : { m: t[0], d: "1" }) : { m: t[0], d: t[1] };
  };
  const sMD = parse(parts[0], null);
  const eMD = parse(parts[1] || parts[0], sMD?.m);
  const toISO = (md) => md ? DateTime.fromFormat(`${md.m} ${md.d}, ${year}`, "MMM d, yyyy").toISODate() : null;
  const start = toISO(sMD);
  return { start, end: toISO(eMD) || start };
}

function normalizeManualEvent(slug, data) {
  if (!data || typeof data !== "object" || data.excludeFromSite) return null;
  const d = { ...data };
  if (!d.startDate || !d.endDate) Object.assign(d, { startDate: deriveStartEndFromDates(d.dates).start, endDate: deriveStartEndFromDates(d.dates).end });
  return {
    slug: d.slug || slug, name: d.name || slug, dates: d.dates || (d.startDate ? DateTime.fromISO(d.startDate).toFormat("MMM d, yyyy") : ""),
    startDate: d.startDate || null, endDate: d.endDate || d.startDate || null, location: d.location || "", tier: d.tier || "B"
  };
}

function calculateEWMA(points, span) {
  if (!points?.length) return null;
  points.sort((a, b) => a.date - b.date);
  let ewma = getAverage(points.map(p => p.value));
  const alpha = 2 / (span + 1);
  for (const p of points) ewma = alpha * p.value + (1 - alpha) * ewma;
  return ewma;
}

function calculateLogScore(placement, entrants) {
  if (placement === 1) return 100;
  if (!entrants || entrants < 2) return 0;
  const logEntrants = Math.log10(entrants);
  const score = (Math.log10(entrants / placement) / logEntrants) * 100;
  return Math.max(0, score);
}

/**
 * Exact Spreadsheet Formulas for Base Points, Tier+Entrants Multiplier, and Decay Factor
 */
function getSheetBasePoints(finish) {
  const f = parseInt(finish, 10);
  if (!Number.isFinite(f) || f < 1 || f > 50) return 0;
  return BASE_POINTS_BY_FINISH[f] || 0;
}

function getSheetEventMultiplier(tier, entrants) {
  const t = String(tier || 'B').trim().toUpperCase();
  const n = parseInt(entrants, 10) || 0;

  if (t === 'S+') {
    if (n >= 2048) return 13;
    if (n >= 1025) return 11;
    if (n >= 513)  return 9;
    return 7;
  }
  if (t === 'S') {
    if (n >= 512) return 7;
    if (n >= 257) return 5.5;
    return 4;
  }
  if (t === 'A') {
    if (n >= 256) return 4;
    if (n >= 129) return 3;
    return 2;
  }
  // Default: B Tier
  if (n >= 128) return 1;
  if (n >= 65)  return 0.75;
  if (n >= 33)  return 0.5;
  return 0.25;
}

function roundUp4(val) {
  return Math.ceil((val - 1e-12) * 10000) / 10000;
}

function getSheetDecayFactor(eventDate, checkDate) {
  const diffDays = (checkDate.getTime() - eventDate.getTime()) / 86400000;
  if (diffDays < 0) return 0;
  const k2 = Math.floor(diffDays / 30.4375);
  if (k2 > 12) return 0;
  const raw = 1 - (1 / 12) * k2;
  return raw <= 0 ? 0 : roundUp4(raw);
}

/**
 * Reconstructs weekly ranks using the exact Google Sheet formula.
 */
function computeLifetimeWeeklyRanks(allPlayers, tournaments, now, oneYearAgo) {
  const MS_PER_DAY = 86400000;
  const MS_PER_WEEK = 7 * MS_PER_DAY;

  const eventsWithDates = (tournaments || [])
    .map(ev => {
      const dt = new Date(ev.date);
      const tier = ev.Tier || 'B';
      const entrants = parseInt(ev.Entrants, 10) || 0;
      return {
        date: dt,
        multiplier: getSheetEventMultiplier(tier, entrants),
        results: Array.isArray(ev.results) ? ev.results : []
      };
    })
    .filter(ev => !isNaN(ev.date.getTime()))
    .sort((a, b) => a.date - b.date);

  const weeklyRanksByKey = new Map();
  allPlayers.forEach(p => {
    const k = normalizePlayerKey(p.name);
    if (k) weeklyRanksByKey.set(k, []);
  });

  if (eventsWithDates.length > 0) {
    const epochDate = new Date(TRACKING_EPOCH_ISO + "T00:00:00Z");
    const earliestEventDate = eventsWithDates[0].date;
    const startCheckpoint = earliestEventDate > epochDate ? earliestEventDate : epochDate;
    const totalWeeks = Math.max(1, Math.floor((now.getTime() - startCheckpoint.getTime()) / MS_PER_WEEK));

    const checkpoints = [];
    for (let w = totalWeeks; w >= 0; w--) {
      checkpoints.push(new Date(now.getTime() - (w * MS_PER_WEEK)));
    }

    checkpoints.forEach(checkDate => {
      const windowStart = new Date(checkDate.getTime() - (370 * MS_PER_DAY));
      const playerScores = new Map();

      for (let i = 0; i < eventsWithDates.length; i++) {
        const ev = eventsWithDates[i];
        if (ev.date > checkDate) break;
        if (ev.date < windowStart) continue;

        const decay = getSheetDecayFactor(ev.date, checkDate);
        if (decay <= 0) continue;

        ev.results.forEach(res => {
          const pKey = normalizePlayerKey(res.Player);
          if (!pKey || !weeklyRanksByKey.has(pKey)) return;

          const basePts = getSheetBasePoints(res.Finish);
          if (basePts <= 0) return;

          const pts = basePts * ev.multiplier * decay;
          if (!playerScores.has(pKey)) playerScores.set(pKey, []);
          playerScores.get(pKey).push(pts);
        });
      }

      const rankedThisWeek = [];
      playerScores.forEach((scores, pKey) => {
        scores.sort((a, b) => b - a);
        const total = scores.slice(0, EVENT_CAP).reduce((a, b) => a + b, 0);
        if (total > 0) rankedThisWeek.push({ key: pKey, score: total });
      });

      rankedThisWeek.sort((a, b) => b.score - a.score);
      rankedThisWeek.forEach((entry, idx) => {
        weeklyRanksByKey.get(entry.key).push({
          date: checkDate,
          rank: idx + 1
        });
      });
    });
  }

  // Assign Lifetime Peak Rank (PR), Lifetime Weeks in Top 40 (TR), and Last-12-Months Chart Points
  allPlayers.forEach((p, idx) => {
    const pKey = normalizePlayerKey(p.name);
    const fullHistory = (pKey && weeklyRanksByKey.get(pKey)) ? weeklyRanksByKey.get(pKey) : [];

    const candidateRanks = fullHistory
      .map(h => Number(h.rank))
      .filter(r => Number.isFinite(r) && r > 0);

    const liveRank = Number.isFinite(Number(p.rank)) && Number(p.rank) > 0 ? Number(p.rank) : (idx + 1);
    p.rank = liveRank;
    candidateRanks.push(liveRank);

    // 1. Guaranteed Peak Rank for ALL players (1..200+)
    const bestRank = Math.min(...candidateRanks);
    p.stats_1yr.peakRank = bestRank;
    p.peakRank = bestRank;

    // 2. Lifetime Weeks in Top 40
    let top40Weeks = fullHistory.filter(h => h.rank > 0 && h.rank <= 40).length;
    if (liveRank <= 40 && top40Weeks === 0) {
      top40Weeks = 1;
    }
    p.stats_recent.weeksInTop40 = top40Weeks;

    // 3. Trailing 12-Month Top 40 History for the Ranking History Chart
    const recent12MoHistory = fullHistory
      .filter(h => h.date >= oneYearAgo && h.rank > 0 && h.rank <= 40)
      .sort((a, b) => a.date - b.date)
      .map(h => ({
        date: h.date.toISOString().slice(0, 10),
        rank: h.rank
      }));

    if (liveRank > 0 && liveRank <= 40) {
      const todayIso = now.toISOString().slice(0, 10);
      const lastEntry = recent12MoHistory[recent12MoHistory.length - 1];
      if (!lastEntry || lastEntry.date !== todayIso) {
        recent12MoHistory.push({ date: todayIso, rank: liveRank });
      } else {
        lastEntry.rank = liveRank;
      }
    }

    p.historicalData = recent12MoHistory;
  });
}

// --- Main Processor ---
module.exports = async function () {
  try {
    const getRankings = require("./rankings.js");
    const getTournaments = require("./tournaments.js");

    const [rankingsData, tournamentsData] = await Promise.all([
      getRankings(), getTournaments()
    ]);

    const tournaments = tournamentsData.events || [];
    if (!rankingsData.players || rankingsData.players.length === 0) return [];

    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(now.getFullYear() - 1);
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(now.getMonth() - 6);

    // 1. Initialize Players
    const slugCounts = {};
    let allPlayers = rankingsData.players.map((p, idx) => {
      const playerName = String(getRowValue(p, "Player") || p.Player || "").trim();
      const englishName = getRowValue(p, "English Name") || p['English Name'] || null;
      const rank = getPlayerRankFromRow(p, idx);

      const src = englishName || playerName;
      let slug = createSafeSlug(src);
      if (!slug) slug = getRowValue(p, "Player ID") || `player-${rank}`;
      
      if (slugCounts[slug]) slug = `${slug}-${++slugCounts[slug]}`;
      else slugCounts[slug] = 1;

      const rawChar = getRowValue(p, "Main Character") || getRowValue(p, "Character") || getRowValue(p, "Main") || "";
      const cleanChar = String(rawChar).trim();
      const rawCountry = getRowValue(p, "Country") || p.Country || "";
      const cleanCountry = String(rawCountry).trim();

      return {
        name: playerName,
        englishName,
        rank,
        slug,
        _rankingRow: p,
        startggSlug: null,
        rankChange: getRowValue(p, "Rank Change") ?? p['Rank Change'],
        photoUrl: `/images/players/${slug}.png`,
        country: cleanCountry && cleanCountry.toUpperCase() !== 'N/A' ? cleanCountry : null,
        countryCode: (getRowValue(p, "CountryCode") || p.CountryCode)?.toLowerCase() || null,
        mainCharacter: cleanChar && cleanChar.toUpperCase() !== 'N/A' ? cleanChar : null,
        game: "sf6",
        socials: {},
        notableWins: [1, 2, 3].map(i => getRowValue(p, `Notable Win ${i}`)).filter(Boolean),
        results: [],
        historicalData: [],
        trophies_1yr: {},
        stats_1yr: {},
        stats_recent: {},
        leaderRank: {}
      };
    });

    // 2. Process Data Links (Case-insensitive matching)
    const playerByKey = new Map();
    allPlayers.forEach(p => {
      const k = normalizePlayerKey(p.name);
      if (k && !playerByKey.has(k)) playerByKey.set(k, p);
    });

    tournaments.forEach(ev => {
      const dt = new Date(ev.date);
      ev.results.forEach(res => {
        const pl = playerByKey.get(normalizePlayerKey(res.Player));
        if (pl) {
          const finish = parseInt(res.Finish, 10);
          const resChar = res['Main Character'] || res.Character || res.char || null;
          pl.results.push({
            tournament: ev.name,
            slug: ev.slug,
            date: dt,
            placement: finish,
            character: resChar ? String(resChar).trim() : null,
            entrants: parseInt(ev.Entrants, 10) || 0,
            tier: ev.Tier || 'B', 
            icon: [1, 2, 3].includes(finish) ? `<i class="fas fa-trophy trophy-${finish}"></i>` : (finish === 4 ? '<i class="fas fa-medal medal-4"></i>' : '')
          });
        }
      });
    });

    // Compute exact spreadsheet-based weekly ranks, Peak Rank (PR), and Weeks in Top 40 (TR)
    computeLifetimeWeeklyRanks(allPlayers, tournaments, now, oneYearAgo);

    // Event Strength
    const evStr = tournaments.map(ev => ({ 
      slug: ev.slug, 
      raw: (TDR_MULTIPLIERS[ev.Tier] || 1.0) * Math.log10(Math.max(2, parseInt(ev.Entrants)||0))
    }));
    const sVals = evStr.map(e => e.raw).filter(Number.isFinite);
    const sMin = Math.min(...sVals || [0]), sMax = Math.max(...sVals || [1]);
    const eventStrengthMap = new Map();
    evStr.forEach(({ slug, raw }) => {
      const t = sMax > sMin ? (raw - sMin) / (sMax - sMin) : 0.5;
      eventStrengthMap.set(slug, 0.5 + t * 1.0);
    });

    // 3. Player Stats Calculation
    for (const p of allPlayers) {
      p.results.sort((a, b) => b.date - a.date);
      if (!p.mainCharacter) {
        const latestWithChar = p.results.find(r => r.character && r.character.toUpperCase() !== 'N/A');
        if (latestWithChar) p.mainCharacter = latestWithChar.character;
      }
      p.characterFileName = getCharacterFileName(p.mainCharacter);
      
      p.results_1yr = p.results.filter(r => r.date >= oneYearAgo);
      const r1y = p.results_1yr;
      const ents = r1y.filter(r => r.entrants > 1);

      // Basic Counts
      p.trophies_1yr = {
        victories: r1y.filter(r => r.placement === 1).length,
        top3: r1y.filter(r => r.placement <= 3).length,
        top8: r1y.filter(r => r.placement <= 8).length,
        top16: r1y.filter(r => r.placement <= 16).length
      };

      // Averages
      const plcs = r1y.map(r => r.placement);
      const majPlc = r1y.filter(r => r.tier.startsWith('S')).map(r => r.placement);
      p.stats_1yr.avgFinish = plcs.length >= 3 ? getAverage(plcs) : null;
      p.stats_1yr.avgFinishMajors = majPlc.length >= 3 ? getAverage(majPlc) : null;

      // Display Percentiles
      const getPcts = (set) => set.filter(r => r.entrants >= 64).map(r => ((r.entrants - r.placement) / (r.entrants - 1)) * 100);
      const allPcts = getPcts(ents);
      const majPcts = getPcts(ents.filter(r => r.tier.startsWith('S')));
      p.stats_1yr.avgPercentile = allPcts.length >= 3 ? getAverage(allPcts) : null;
      p.stats_1yr.avgPercentileMajors = majPcts.length >= 3 ? getAverage(majPcts) : null;

      // Performance Floor
      const pfRes = ents.filter(r => r.entrants >= 64);
      if (pfRes.length >= 3) {
        const wPerfs = pfRes.map(r => (((r.entrants - r.placement)/(r.entrants - 1))*100) * (eventStrengthMap.get(r.slug) ?? 1.0)).sort((a, b) => a - b);
        const cut = Math.max(2, Math.floor(wPerfs.length * 0.25));
        p.observed_performanceFloor = getAverage(wPerfs.slice(0, cut));
        p.pf_result_count = wPerfs.length;
      } else {
        p.observed_performanceFloor = null;
        p.pf_result_count = pfRes.length;
      }

      // TDR
      const tdrScores = ents.map(r => (TDR_MULTIPLIERS[r.tier]||1.0) * Math.log10(r.entrants));
      p.stats_1yr.TDR = tdrScores.length >= 3 ? parseFloat(getAverage(tdrScores).toFixed(2)) : null;

      // Signature Performance
      const best = [...ents].sort((a, b) => {
        const tierO = { 'S+': 3, 'S': 2, 'A': 1, 'B': 0 };
        return (a.placement - b.placement) || ((tierO[b.tier]??-1) - (tierO[a.tier]??-1)) || (b.entrants - a.entrants) || (b.date - a.date);
      })[0];
      if (best) p.signaturePerformance_1yr = {
        tournamentName: best.tournament, slug: best.slug, entrants: best.entrants, tier: best.tier,
        placementIcon: best.icon || `${best.placement}`, tierName: getTierName(best.tier)
      };

      // Recent Finish (6M)
      const recRes = p.results.filter(r => r.date >= sixMonthsAgo);
      p.stats_recent.avgFinish = recRes.length >= 2 ? getAverage(recRes.map(r => r.placement)) : null;

      // Momentum Score
      if (r1y.length >= 2) {
        const msPts = ents.map(r => ({ 
          date: r.date, 
          value: calculateLogScore(r.placement, r.entrants) * (PF_TIER_WEIGHTS[r.tier]||0.75) 
        }));
        p.stats_1yr.momentumScore = calculateEWMA(msPts, 60);
        const daysIdle = (now - r1y[0].date) / 86400000;
        if (daysIdle > 30 && p.stats_1yr.momentumScore) p.stats_1yr.momentumScore = Math.max(0, p.stats_1yr.momentumScore - ((daysIdle - 30) * 0.20));
      } else p.stats_1yr.momentumScore = null;

      // Flags & Stats Object
      p.totalTournaments = p.results.length;
      p.isQualified = r1y.length >= 4;
      
      const recMaj = recRes.filter(r => r.tier.startsWith('S')).map(r => r.placement);
      const guaranteedPR = p.stats_1yr.peakRank || p.rank || null;
      p.stats = {
        V: p.trophies_1yr.victories, T3: p.trophies_1yr.top3, T8: p.trophies_1yr.top8, T16: p.trophies_1yr.top16,
        AF12: p.stats_1yr.avgFinish?.toFixed(2)??null, AF6: p.stats_recent.avgFinish?.toFixed(2)??null,
        AFM12: p.stats_1yr.avgFinishMajors?.toFixed(2)??null, AFM6: (recMaj.length>=2 ? getAverage(recMaj).toFixed(2) : null),
        APP: p.stats_1yr.avgPercentile?.toFixed(2)??null, APM: p.stats_1yr.avgPercentileMajors?.toFixed(2)??null,
        PF: null, MS: p.stats_1yr.momentumScore?.toFixed(2)??null, TDR: p.stats_1yr.TDR?.toFixed(2)??null,
        PR: guaranteedPR, TR: p.stats_recent.weeksInTop40, FGPI: null
      };
      p.tooltips = TOOLTIP_TEXT; p.statRanks = {}; p.rawFGPI = null;
    }

    // 4. PF Shrinkage
    const pfPlayers = allPlayers.filter(p => p.pf_result_count > 0 && p.observed_performanceFloor !== null);
    const globalPF = getAverage(pfPlayers.map(p => p.observed_performanceFloor)) || 50;
    allPlayers.forEach(p => {
      if (p.pf_result_count > 0 && p.observed_performanceFloor !== null) {
        const w = p.pf_result_count / (p.pf_result_count + 5);
        let robust = (w * p.observed_performanceFloor) + ((1 - w) * globalPF);
        if (p.stats.APP && robust > parseFloat(p.stats.APP)) robust = parseFloat(p.stats.APP);
        p.stats.PF = robust.toFixed(2);
      } else p.stats.PF = null;
    });

    // 5. FGPI Calculation
    const fgpiPlayers = allPlayers.filter(p => p.results_1yr.length > 0);
    fgpiPlayers.forEach(p => {
      let wSum = 0, wTot = 0, peakRaw = [];
      p.results_1yr.forEach(r => {
        if (r.entrants > 1) {
          const logScore = calculateLogScore(r.placement, r.entrants);
          const tw = TDR_MULTIPLIERS[r.tier] || 0; 
          wSum += logScore * tw; 
          wTot += tw;
        }
        
        const pts = TIER_POINTS[r.tier];
        if (pts) {
          let base = 0;
          if (r.placement === 1) base = pts.victory;
          else if (r.placement <= 3) base = pts.top3;
          else if (r.placement <= 8) base = pts.top8;
          else if (r.placement <= 16) base = pts.top16;
          else base = pts.top16 * 0.5; 

          if (base > 0) {
            const daysOld = (now - r.date) / (1000 * 60 * 60 * 24);
            const timeWeight = Math.max(0.3, 1.0 - ((daysOld / 365) * 0.7));
            peakRaw.push(base * timeWeight);
          }
        }
      });

      p.fgpi_WAPP = wTot ? wSum / wTot : 0;
      p.fgpi_peakScore = peakRaw.sort((a,b)=>b-a).slice(0, 10).reduce((a,b)=>a+b, 0);
      
      p.fgpi_tournamentsAttended = p.results_1yr.length;
      p.fgpi_majorsAttended = p.results_1yr.filter(r => r.tier.startsWith('S')).length;
      
      p.fgpi_APM = parseFloat(p.stats.APM)||0; 
      p.fgpi_PF = parseFloat(p.stats.PF)||0; 
      p.fgpi_MS = parseFloat(p.stats.MS)||0;
      p.fgpi_afCombined = (0.7 * (parseFloat(p.stats.AF6)||100)) + (0.3 * (parseFloat(p.stats.AF12)||100));
      p.fgpi_afmCombined = (0.7 * (parseFloat(p.stats.AFM6)||100)) + (0.3 * (parseFloat(p.stats.AFM12)||100));
    });

    // Calculate Z-Scores
    const compKeys = ['fgpi_WAPP', 'fgpi_peakScore', 'fgpi_APM', 'fgpi_PF', 'fgpi_MS', 'fgpi_afCombined', 'fgpi_afmCombined'];
    compKeys.forEach(k => {
      const vals = fgpiPlayers.map(p => p[k]).filter(Number.isFinite);
      if (vals.length < 2) return;
      const mean = getAverage(vals);
      const sd = Math.sqrt(vals.map(x=>(x-mean)**2).reduce((a,b)=>a+b,0)/(vals.length-1));
      fgpiPlayers.forEach(p => { p[`z_${k}`] = sd ? ((p[k]||0)-mean)/sd : 0; });
    });

    // Final Scoring
    fgpiPlayers.forEach(p => {
      const f_Accumulation = (p.z_fgpi_peakScore * 0.85) + (p.z_fgpi_WAPP * 0.15);
      const f_Consistency = ((-p.z_fgpi_afCombined) + (-p.z_fgpi_afmCombined) + p.z_fgpi_APM + p.z_fgpi_PF) / 4;
      const successCount = Math.max(1, p.fgpi_tournamentsAttended);
      const volumeMultiplier = 0.91 + (Math.log10(successCount + 1) * 0.12); 
      
      let baseScore = (f_Accumulation * 6.0) + (f_Consistency * 2.0);
      p.rawFGPI = baseScore * volumeMultiplier;
    });

    const rawS = fgpiPlayers.map(p => p.rawFGPI).filter(v => v !== null);
    const minR = Math.min(...rawS), maxR = Math.max(...rawS), rng = maxR - minR;
    fgpiPlayers.forEach(p => {
      if (p.rawFGPI !== null) {
        const n = rng === 0 ? 50 : 0.01 + (((p.rawFGPI - minR) / rng) * 99.98);
        p.fgpiNormalized = n;
        p.stats.FGPI = n.toFixed(2); 
      } else { p.fgpiNormalized = null; p.stats.FGPI = null; }
    });

    // 6. Ranks & Leaderboards
    const qualP = allPlayers.filter(p => p.isQualified);
    const rankKeys = [
      {k:'FGPI',d:1},{k:'TDR',d:1},{k:'PF',d:1},{k:'MS',d:1},{k:'APP',d:1},{k:'APM',d:1},
      {k:'AF12',d:0},{k:'AF6',d:0},{k:'AFM12',d:0},{k:'AFM6',d:0},
      {k:'V',d:1},{k:'T3',d:1},{k:'T8',d:1},{k:'T16',d:1},{k:'PR',d:0},{k:'TR',d:1}
    ];
    rankKeys.forEach(({k, d}) => {
      const list = qualP.map(p => ({ p, v: parseFloat(p.stats[k]) })).filter(x => Number.isFinite(x.v));
      list.sort((a, b) => (d ? b.v - a.v : a.v - b.v) || (a.p.rank||999) - (b.p.rank||999));
      let r = 0, prev = null;
      list.forEach((item, i) => {
        if (item.v !== prev) r = i + 1;
        item.p.statRanks[k] = r;
        prev = item.v;
      });
    });

    const getV = (o, path) => path.split('.').reduce((x, i) => x?.[i], o);
    const ldrStats = [
      {k:'victories',p:'trophies_1yr.victories'}, {k:'top3',p:'trophies_1yr.top3'}, {k:'top8',p:'trophies_1yr.top8'},
      {k:'top16',p:'trophies_1yr.top16'}, {k:'weeksInTop40',p:'stats_recent.weeksInTop40'},
      {k:'avgFinish',p:'stats_1yr.avgFinish',asc:true}, {k:'avgFinishRecent',p:'stats_recent.avgFinish',asc:true}, 
      {k:'avgFinishMajors',p:'stats_1yr.avgFinishMajors',asc:true}
    ];
    ldrStats.forEach(({k, p, asc}) => {
      const list = qualP.filter(pl => getV(pl, p) != null).sort((a, b) => {
        const va = getV(a, p), vb = getV(b, p);
        return (asc ? va - vb : vb - va) || (a.rank||999) - (b.rank||999);
      });
      list.slice(0, 5).forEach((l, i) => { 
        const pl = allPlayers.find(x => x.slug === l.slug);
        if (pl) pl.leaderRank[k] = i + 1; 
      });
    });

    // 7. Finalize
    allPlayers.sort((a, b) => (a.rank||99999) - (b.rank||99999));

    const countryRankCounts = {};
    const charRankCounts = {};

    allPlayers.forEach((p, i, arr) => {
      p.previousPlayer = i > 0 ? { name: arr[i-1].name, slug: arr[i-1].slug, rank: arr[i-1].rank } : null;
      p.nextPlayer = i < arr.length-1 ? { name: arr[i+1].name, slug: arr[i+1].slug, rank: arr[i+1].rank } : null;

      // 1. Country Rank
      const cKey = (p.country && p.country !== 'N/A') ? p.country.trim().toUpperCase() : null;
      if (cKey && p.rank) {
        countryRankCounts[cKey] = (countryRankCounts[cKey] || 0) + 1;
        p.countryRank = countryRankCounts[cKey];
      } else {
        p.countryRank = null;
      }

      // 2. Character Specialist Rank
      const charKey = (p.mainCharacter && p.mainCharacter !== 'N/A')
        ? getCharacterFileName(p.mainCharacter)
        : null;
      if (charKey && p.rank) {
        charRankCounts[charKey] = (charRankCounts[charKey] || 0) + 1;
        p.characterRank = charRankCounts[charKey];
      } else {
        p.characterRank = null;
      }

      // 3. 6-Month Change
      p.rankChange6m = getSheet6MChange(p._rankingRow);
    });

    const slugsToFetch = new Set();
    qualP.forEach(p => {
      const s1 = getStartggSlugFromRow(p._rankingRow);
      if (s1) slugsToFetch.add(s1);
    });
    const startggData = await getStartggSocials({ requestedSlugs: [...slugsToFetch] });
    
    allPlayers.forEach(p => {
      const { socials, startggSlug } = buildPlayerSocials(p._rankingRow, p.slug, startggData);
      p.socials = socials || {};
      p.startggSlug = startggSlug || null;
      delete p._rankingRow;
    });

    try {
      const upcInput = allPlayers.filter(p => p.startggSlug).map(p => ({ name: p.name, startggSlug: p.startggSlug, profileSlug: p.slug, rank: p.rank }));
      const { playerUpcomingMap } = await collectUpcomingForPlayers(upcInput, { topN: 100, offlineOnly: true });
      const manualMap = {};
      Object.entries(upcomingOverrides||{}).forEach(([k, v]) => {
        const ev = normalizeManualEvent(k, v);
        if (!ev) return;
        const targets = v.playerSlugs || (v.notablePlayers?.map(n => createSafeSlug(n))) || [];
        targets.forEach(ts => { 
          const s = ts?.trim().toLowerCase(); 
          if (s) { manualMap[s] = manualMap[s] || []; manualMap[s].push(ev); }
        });
      });
      allPlayers.forEach(p => {
        const upc = (playerUpcomingMap[p.slug] || []).filter(e => !EXCLUDED_TOURNAMENT_SLUGS.has(e.slug));
        const man = manualMap[p.slug] || [];
        man.forEach(m => {
          const idx = upc.findIndex(u => u.slug === m.slug);
          if (idx >= 0) upc[idx] = m; else upc.push(m);
        });
        p.upcomingTournaments = upc.sort((a, b) => (new Date(a.startDate) - new Date(b.startDate)) || a.name.localeCompare(b.name));
      });
    } catch (e) {
      // Ignore upcoming tournaments fetch failure gracefully
    }

    return allPlayers;

  } catch (error) {
    console.error("❌ ERROR in playerProfiles data loader:", error);
    return [];
  }
};