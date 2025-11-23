// api/players.js  (you can also name it api/players.11ty.js)
// Outputs /api/players.json with { lastUpdated, count, allPlayers }.
// Converted to proper 11ty template: data() + render() so metadata isn't lost.

const slugify = require("slugify");
const getStartggSocials = require("../_data/startggSocials.js");
const { buildPlayerSocials, extractSlugFromUrl } = require("../_data/lib/playerSocials.js");

function getMedian(arr) {
  if (!arr || arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function getAverage(arr) {
  if (!arr || arr.length === 0) return null;
  const sum = arr.reduce((a, b) => a + b, 0);
  return sum / arr.length;
}

function calculateEWMA(dataPoints, span) {
  if (!dataPoints || dataPoints.length === 0) return null;
  const sortedPoints = [...dataPoints].sort((a, b) => a.date.getTime() - b.date.getTime());
  const alpha = 2 / (span + 1);
  const allValues = sortedPoints.map(p => p.value);
  const mean = getAverage(allValues);
  if (mean === null) return null;
  let ewma = mean;
  for (let i = 0; i < sortedPoints.length; i++) {
    ewma = alpha * sortedPoints[i].value + (1 - alpha) * ewma;
  }
  return ewma;
}

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

function normalizeSlugValue(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed.toLowerCase() : null;
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

function fallbackSlugifyForSocials(str) {
  return (str || "")
    .toString()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['\"\u2018\u2019\u201c\u201d]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readFirstSlugField(row, fields) {
  if (!row) return null;
  for (const field of fields) {
    const raw = getRowValue(row, field);
    const normalized = normalizeSlugValue(raw);
    if (normalized) return normalized;
  }
  return null;
}

function getStartggSlugFromRow(row) {
  const raw = readFirstSlugField(row, STARTGG_SLUG_FIELDS);
  if (!raw) return null;

  if (/^https?:\/\//i.test(raw)) {
    const extracted = extractSlugFromUrl(raw);
    return extracted ? extracted.toLowerCase() : null;
  }

  return raw.toLowerCase();
}

function createSafeSlug(name) {
  const s = String(name || '')
    // remove emoji/pictographs & parens; keep numbers
    .replace(/[\p{Emoji_Presentation}]/gu, '')
    .replace(/[\p{Extended_Pictographic}]/gu, '')
    .replace(/\uFE0F/g, '')
    .replace(/[()]/g, '')
    .trim();

  return slugify(s, {
    lower: true,
    strict: false,
    locale: 'en',
    remove: /[*+~.()'"!:@]/g
  });
}

function getTierName(tier) {
  if (!tier) return 'Event';
  if (tier.startsWith('S')) return 'Major';
  if (tier === 'A') return 'National';
  if (tier === 'B') return 'Regional';
  return 'Event';
}

function getCharacterFileName(character) {
  if (!character) return '';
  return character
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-');
}

module.exports = {
  // IMPORTANT: with object export, Eleventy keeps both data() & render()
  data() {
    return {
      permalink: "/api/players.json",
      layout: null,
      eleventyExcludeFromCollections: true
    };
  },

  async render() {
    try {
      const getRankings = require("./rankings.js");
      const getTournaments = require("./tournaments.js");
      const getHistoricalData = require("./historical.js");

      const TOOLTIP_TEXT = {
        FGPI: "Fighting Game Performance Index", TDR: "Tournament Difficulty Rating",
        PF: "Performance Floor", MS: "Momentum Score", AF12: "Avg. Finish (12 mo.)",
        AF6: "Avg. Finish (6 mo.)", AFM12: "Avg. Finish at Majors (12 mo.)",
        AFM6: "Avg. Finish at Majors (6 mo.)", APP: "Avg. Placement Percentile",
        APM: "Avg. Percentile at Majors", V: "Victories", T3: "Top 3 Finishes",
        T8: "Top 8 Finishes", T16: "Top 16 Finishes", PR: "Peak Rank", TR: "Top 40 Streak (Weeks)"
      };

      const rankingsData = await getRankings();
      const tournamentsData = await getTournaments();
      const historicalData = await getHistoricalData();
      const tournaments = tournamentsData.events || [];

      // If no players, still return a valid wrapped payload
      if (!rankingsData.players || rankingsData.players.length === 0) {
        const emptyPayload = {
          lastUpdated: rankingsData.lastUpdated || new Date().toISOString(),
          count: 0,
          allPlayers: []
        };
        return JSON.stringify(emptyPayload, null, 2);
      }

      function computeRankChange(player, allHistoricalRecords) {
        let rcRaw = (player['Rank Change'] || '').toString().trim();
        if (['—', '–', '-', '0', ''].includes(rcRaw)) {
          rcRaw = '';
        }
        if (rcRaw && rcRaw !== '0') {
          return rcRaw;
        }
        const curr = parseInt(player.Rank, 10);
        if (!curr) return null;
        const playerHistory = allHistoricalRecords
          .filter(h => h.Player === player.Player)
          .sort((a, b) => new Date(b.Date) - new Date(a.Date));

        if (playerHistory.length < 2) {
          return curr <= 40 ? 'New' : null;
        }

        const prev = parseInt(playerHistory[1].Rank, 10);

        if (!prev || prev > 40) {
          return curr <= 40 ? 'New' : null;
        }
        const diff = prev - curr;

        if (diff > 0) return `+${diff}`;
        if (diff < 0) return `${diff}`;
        return '0';
      }

      let allPlayers = rankingsData.players.map(p => {
        const playerSlug = createSafeSlug(p.Player);
        const notableWins = [];
        if (p['Notable Win 1'] && p['Notable Win 1'].trim() !== '') notableWins.push(p['Notable Win 1']);
        if (p['Notable Win 2'] && p['Notable Win 2'].trim() !== '') notableWins.push(p['Notable Win 2']);
        if (p['Notable Win 3'] && p['Notable Win 3'].trim() !== '') notableWins.push(p['Notable Win 3']);
        return {
          name: p.Player,
          rank: parseInt(p.Rank, 10),
          slug: playerSlug,
          startggSlug: null,
          rankChange: p['Rank Change'] || null,
          photoUrl: `/images/players/${playerSlug}.png`,
          country: p.Country,
          countryCode: p.CountryCode ? p.CountryCode.toLowerCase() : null,
          mainCharacter: p['Main Character'],
          game: "sf6",
          socials: {},
          notableWins: notableWins,
          results: [],
          historicalData: [],
          _rankingRow: p,
          _baseSlug: playerSlug,
        };
      });

      // ensure unique slugs
      const slugCounts = {};
      allPlayers.forEach(player => {
        const originalSlug = player.slug;
        let count = slugCounts[originalSlug];
        if (count) {
          count++;
          slugCounts[originalSlug] = count;
          player.slug = `${originalSlug}-${count}`;
        } else {
          slugCounts[originalSlug] = 1;
        }
      });

      // attach tournament results
      tournaments.forEach(event => {
        event.results.forEach(result => {
          const player = allPlayers.find(p => p.name === result.Player);
          if (player) {
            player.results.push({
              tournament: event.name, slug: event.slug, date: new Date(event.date),
              placement: parseInt(result.Finish, 10), entrants: parseInt(event['Entrants'], 10) || 0,
              tier: event.Tier || 'C', icon: parseInt(result.Finish, 10) === 1 ? '<i class="fas fa-trophy trophy-1"></i>' :
                parseInt(result.Finish, 10) === 2 ? '<i class="fas fa-trophy trophy-2"></i>' :
                parseInt(result.Finish, 10) === 3 ? '<i class="fas fa-trophy trophy-3"></i>' :
                parseInt(result.Finish, 10) === 4 ? '<i class="fas fa-medal medal-4"></i>' : '',
            });
          }
        });
      });

      // attach ranking history
      historicalData.records.forEach(record => {
        const player = allPlayers.find(p => p.name === record.Player);
        if (player) {
          player.historicalData.push({ date: new Date(record.Date), rank: parseInt(record.Rank, 10) });
        }
      });

      // ---- lots of metric calculations (unchanged from your file) ----
      const oneYearAgo = new Date(); oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const TDR_MULTIPLIERS = { 'S+': 4.0, 'S': 3.0, 'A': 2.0, 'B': 1.0, 'C': 0.4 };
      const PF_TIER_WEIGHTS = { 'S+': 1.0, 'S': 0.95, 'A': 0.85, 'B': 0.75 };

      const eventStrengths = (tournaments || []).map(ev => {
        const entrants = Math.max(2, parseInt(ev.Entrants, 10) || 0);
        const tierMult = TDR_MULTIPLIERS[ev.Tier] || 0.4;
        return { slug: ev.slug, raw: tierMult * Math.log10(entrants) };
      });
      const rawS = eventStrengths.map(e => e.raw).filter(Number.isFinite);
      const sMin = rawS.length ? Math.min(...rawS) : 0;
      const sMax = rawS.length ? Math.max(...rawS) : 1;
      const eventStrengthMap = new Map();
      eventStrengths.forEach(({ slug, raw }) => {
        const t = sMax > sMin ? (raw - sMin) / (sMax - sMin) : 0.5;
        const mult = 0.75 + t * 0.5;
        eventStrengthMap.set(slug, mult);
      });

      const MIN_TOURNAMENTS_FOR_QUALIFICATION = 4;
      const ACTIVITY_SCORE_CAP = 10;
      const MAJOR_ACTIVITY_BONUS_CAP = 5;
      const AF6_INACTIVITY_PENALTY = 100;
      const AFM6_INACTIVITY_PENALTY = 100;
      const AFM12_INACTIVITY_PENALTY = 100;

      const MIN_ENTRANTS_FOR_AVG_PERCENTILE = 64;

      for (const player of allPlayers) {
        player.results.sort((a, b) => b.date - a.date);
        player.historicalData.sort((a, b) => b.date - a.date);
        player.characterFileName = getCharacterFileName(player.mainCharacter);
        const results1yr = player.results.filter(r => r.date >= oneYearAgo);
        player.results_1yr = results1yr;
        player.trophies_1yr = {}; player.stats_1yr = {};
        player.signaturePerformance_1yr = null; player.stats_recent = {};
        if (results1yr.length > 0) {
          player.trophies_1yr.victories = results1yr.filter(r => r.placement === 1).length;
          player.trophies_1yr.top3 = results1yr.filter(r => r.placement <= 3).length;
          player.trophies_1yr.top8 = results1yr.filter(r => r.placement <= 8).length;
          player.trophies_1yr.top16 = results1yr.filter(r => r.placement <= 16).length;

          const placements1yr = results1yr.map(r => r.placement);
          const majors1yr = results1yr.filter(r => r.tier === 'S+' || r.tier === 'S');
          const majorPlacements1yr = majors1yr.map(r => r.placement);
          player.stats_1yr.avgFinish = placements1yr.length >= 3 ? getAverage(placements1yr) : null;
          player.stats_1yr.avgFinishMajors = majorPlacements1yr.length >= 3 ? getAverage(majorPlacements1yr) : null;

          const resultsWithEntrants = results1yr.filter(r => r.entrants > 1);

          const allPercentiles = resultsWithEntrants
            .filter(r => r.entrants >= MIN_ENTRANTS_FOR_AVG_PERCENTILE)
            .map(r => ((r.entrants - r.placement) / (r.entrants - 1)) * 100);

          const majorPercentiles = resultsWithEntrants
            .filter(r => (r.tier === 'S+' || r.tier === 'S') && r.entrants >= MIN_ENTRANTS_FOR_AVG_PERCENTILE)
            .map(r => ((r.entrants - r.placement) / (r.entrants - 1)) * 100);
          player.stats_1yr.avgPercentile = allPercentiles.length >= 3 ? getAverage(allPercentiles) : null;
          player.stats_1yr.avgPercentileMajors = majorPercentiles.length >= 3 ? getAverage(majorPercentiles) : null;

          if (resultsWithEntrants.length > 0) {
            const weightedPerformances = resultsWithEntrants.map(r => {
              const percentile = ((r.entrants - r.placement) / (r.entrants - 1)) * 100;
              const tierW = PF_TIER_WEIGHTS[r.tier] || 0.75;
              const strengthW = eventStrengthMap.get(r.slug) ?? 1.0;
              return percentile * tierW * strengthW;
            });

            player.pf_result_count = weightedPerformances.length;
            const sortedPerformances = [...weightedPerformances].sort((a, b) => a - b);

            if (sortedPerformances.length === 1) {
              player.observed_performanceFloor = sortedPerformances[0];
            } else if (sortedPerformances.length >= 2) {
              const twoWorst = sortedPerformances.slice(0, 2);
              player.observed_performanceFloor = twoWorst.reduce((a, b) => a + b, 0) / twoWorst.length;
            } else {
              player.observed_performanceFloor = null;
            }
          } else {
            player.observed_performanceFloor = null;
            player.pf_result_count = 0;
          }
          const difficultyScores = resultsWithEntrants.map(r => {
            const multiplier = TDR_MULTIPLIERS[r.tier] || 0.4;
            return multiplier * Math.log10(r.entrants);
          });
          player.stats_1yr.TDR = difficultyScores.length > 0 ? parseFloat((difficultyScores.reduce((a, b) => a + b, 0) / difficultyScores.length).toFixed(2)) : null;

          let bestPerformance = [...resultsWithEntrants].sort((a, b) => {
            const tierOrder = { 'S+': 3, 'S': 2, 'A': 1, 'B': 0 };
            if (a.placement !== b.placement) return a.placement - b.placement;
            const tierA = tierOrder[a.tier] ?? -1; const tierB = tierOrder[b.tier] ?? -1;
            if (tierA !== tierB) return tierB - tierA;
            if (a.entrants !== b.entrants) return b.entrants - a.entrants;
            return b.date - a.date;
          })[0];
          if (bestPerformance) {
            player.signaturePerformance_1yr = {
              tournamentName: bestPerformance.tournament,
              slug: bestPerformance.slug,
              placementIcon: bestPerformance.icon || `#${bestPerformance.placement}`,
              entrants: bestPerformance.entrants,
              tier: bestPerformance.tier,
              tierName: getTierName(bestPerformance.tier)
            };
          }
        } else {
          player.observed_performanceFloor = null;
          player.pf_result_count = 0;
        }
        const rankedHistory = player.historicalData.filter(h => h.rank && h.rank > 0);
        player.stats_1yr.peakRank = rankedHistory.length > 0 ? Math.min(...rankedHistory.map(h => h.rank)) : null;

        const recentResults = player.results.filter(r => r.date >= sixMonthsAgo);

        const recentPlacements = recentResults.map(r => r.placement);
        const recentMajors = recentResults.filter(r => r.tier === 'S+' || r.tier === 'S');
        const recentMajorPlacements = recentMajors.map(r => r.placement);
        player.stats_recent.avgFinish = recentPlacements.length >= 2 ? getAverage(recentPlacements) : null;
        const avgFinishMajors6mo = recentMajorPlacements.length >= 2 ? getAverage(recentMajorPlacements) : null;
        const percentileDataPoints = player.results_1yr.filter(r => r.entrants > 1).map(r => {
          const percentile = ((r.entrants - r.placement) / (r.entrants - 1)) * 100;
          const weightedValue = percentile * (PF_TIER_WEIGHTS[r.tier] || 0.75);
          return { date: r.date, value: weightedValue };
        });
        player.stats_1yr.momentumScore = calculateEWMA(percentileDataPoints, 60);

        let currentStreak = 0;
        for (const record of player.historicalData) {
          if (record.rank && record.rank <= 40) { currentStreak++; } else { break; }
        }
        player.stats_recent.weeksInTop40 = currentStreak;

        player.totalTournaments = player.results.length;
        player.isQualified = player.results_1yr.length >= MIN_TOURNAMENTS_FOR_QUALIFICATION;
        player.stats = {
          V: player.trophies_1yr.victories || 0,
          T3: player.trophies_1yr.top3 || 0,
          T8: player.trophies_1yr.top8 || 0,
          T16: player.trophies_1yr.top16 || 0,
          AF12: typeof player.stats_1yr.avgFinish === 'number' ? player.stats_1yr.avgFinish.toFixed(2) : null,
          AF6: typeof player.stats_recent.avgFinish === 'number' ? player.stats_recent.avgFinish.toFixed(2) : null,
          AFM12: typeof player.stats_1yr.avgFinishMajors === 'number' ? player.stats_1yr.avgFinishMajors.toFixed(2) : null,
          AFM6: typeof avgFinishMajors6mo === 'number' ? avgFinishMajors6mo.toFixed(2) : null,
          APP: typeof player.stats_1yr.avgPercentile === 'number' ? player.stats_1yr.avgPercentile.toFixed(2) : null,
          APM: typeof player.stats_1yr.avgPercentileMajors === 'number' ? player.stats_1yr.avgPercentileMajors.toFixed(2) : null,
          PF: null,
          MS: typeof player.stats_1yr.momentumScore === 'number' ? player.stats_1yr.momentumScore.toFixed(2) : null,
          TDR: typeof player.stats_1yr.TDR === 'number' ? player.stats_1yr.TDR.toFixed(2) : null,
          PR: player.stats_1yr.peakRank, TR: player.stats_recent.weeksInTop40, FGPI: null
        };
        player.tooltips = TOOLTIP_TEXT; player.statRanks = {}; player.rawFGPI = null;
      }

      const playersWithObservedPF = allPlayers.filter(p => p.pf_result_count > 0 && p.observed_performanceFloor !== null);

      if (playersWithObservedPF.length > 0) {
        const allObservedFloors = playersWithObservedPF
          .map(p => p.observed_performanceFloor)
          .filter(f => f !== null && f !== 0);

        const globalAverageFloor = allObservedFloors.length > 0
          ? allObservedFloors.reduce((a, b) => a + b, 0) / allObservedFloors.length
          : 50;

        const K_CREDIBILITY_CONSTANT = 5;

        allPlayers.forEach(player => {
          const observedFloor = player.observed_performanceFloor;
          const N = player.pf_result_count;

          if (N > 0 && observedFloor !== null) {
            const weight = N / (N + K_CREDIBILITY_CONSTANT);
            const robustPF = (weight * observedFloor) + ((1 - weight) * globalAverageFloor);
            player.stats.PF = robustPF.toFixed(2);
          } else {
            player.stats.PF = null;
          }
        });
      } else {
        allPlayers.forEach(player => { player.stats.PF = null; });
      }

      const qualifiedPlayers = allPlayers.filter(p => p.isQualified);

      if (qualifiedPlayers.length > 0) {
        qualifiedPlayers.forEach(player => {
          const TIER_POINTS = {
            'S+': { 'victory': 4.0, 'top3': 2.0, 'top8': 1.0, 'top16': 0.5 },
            'S': { 'victory': 3.0, 'top3': 1.5, 'top8': 0.75, 'top16': 0.4 },
            'A': { 'victory': 2.0, 'top3': 1.0, 'top8': 0.5, 'top16': 0.3 },
            'B': { 'victory': 1.0, 'top3': 0.5, 'top8': 0.25, 'top16': 0.2 },
            'C': { 'victory': 0.5, 'top3': 0.25, 'top8': 0.1, 'top16': 0.05 }
          };
          let wvs = 0, wt3s = 0, wt8s = 0, wt16s = 0;
          let totalPercentilePoints = 0;
          let totalTierWeight = 0;
          const resultsWithEntrants = player.results_1yr.filter(r => r.entrants > 1);

          resultsWithEntrants.forEach(result => {
            const percentile = ((result.entrants - result.placement) / (result.entrants - 1)) * 100;
            const tierWeight = TDR_MULTIPLIERS[result.tier] || 0.4;
            totalPercentilePoints += percentile * tierWeight;
            totalTierWeight += tierWeight;
          });

          player.fgpi_WAPP = totalTierWeight > 0 ? (totalPercentilePoints / totalTierWeight) : 0;

          player.results_1yr.forEach(result => {
            const tierPoints = TIER_POINTS[result.tier];
            if (!tierPoints) return;
            if (result.placement === 1) wvs += tierPoints.victory;
            else if (result.placement <= 3) wt3s += tierPoints.top3;
            else if (result.placement <= 8) wt8s += tierPoints.top8;
            else if (result.placement <= 16) wt16s += tierPoints.top16;
          });
          player.fgpi_wvs = wvs; player.fgpi_wt3s = wt3s; player.fgpi_wt8s = wt8s; player.fgpi_wt16s = wt16s;
          player.fgpi_majorsAttended = player.results_1yr.filter(r => r.tier === 'S+' || r.tier === 'S').length;
          player.fgpi_tournamentsAttended = player.results_1yr.length;
          player.fgpi_APM = parseFloat(player.stats.APM) || 0;
          player.fgpi_PF = parseFloat(player.stats.PF) || 0;
          player.fgpi_MS = parseFloat(player.stats.MS) || 0;
          const af6Value = parseFloat(player.stats.AF6) || 100;
          const af12Value = parseFloat(player.stats.AF12) || 100;
          const afm6Value = parseFloat(player.stats.AFM6) || 100;
          const afm12Value = parseFloat(player.stats.AFM12) || 100;
          player.fgpi_afCombined = (0.7 * af6Value) + (0.3 * af12Value);
          player.fgpi_afmCombined = (0.7 * afm6Value) + (0.3 * afm12Value);
        });

        const componentsToStandardize = ['fgpi_WAPP', 'fgpi_wvs', 'fgpi_wt3s', 'fgpi_wt8s', 'fgpi_wt16s', 'fgpi_APM', 'fgpi_PF', 'fgpi_MS', 'fgpi_afCombined', 'fgpi_afmCombined'];
        for (const key of componentsToStandardize) {
          const values = qualifiedPlayers.map(p => p[key]).filter(v => typeof v === 'number' && isFinite(v));
          if (values.length < 2) continue;
          const mean = values.reduce((a, b) => a + b, 0) / values.length;
          const stdDev = Math.sqrt(values.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / (values.length - 1));
          qualifiedPlayers.forEach(p => {
            if (stdDev > 0) {
              const value = p[key];
              p[`z_${key}`] = (typeof value === 'number' && isFinite(value)) ? (value - mean) / stdDev : 0;
            } else { p[`z_${key}`] = 0; }
          });
        }

        const weights = { WAPP: 3.0, wvs: 1.0, wt3s: 0.8, wt8s: 0.5, wt16s: 0.3, PF: 0.5, AS: 0.1, APM: 2.5, MAB: 1.5, afCombined: 1.5, afmCombined: 2.0, MS: 1.5 };
        qualifiedPlayers.forEach(player => {
          let performanceScore = 0;
          performanceScore += (player.z_fgpi_WAPP || 0) * weights.WAPP;
          performanceScore += (player.z_fgpi_wvs || 0) * weights.wvs;
          performanceScore += (player.z_fgpi_wt3s || 0) * weights.wt3s;
          performanceScore += (player.z_fgpi_wt8s || 0) * weights.wt8s;
          performanceScore += (player.z_fgpi_wt16s || 0) * weights.wt16s;
          performanceScore += (player.z_fgpi_APM || 0) * weights.APM;
          performanceScore += (player.z_fgpi_PF || 0) * weights.PF;
          performanceScore += (player.z_fgpi_MS || 0) * weights.MS;
          performanceScore -= (player.z_fgpi_afCombined || 0) * weights.afCombined;
          performanceScore -= (player.z_fgpi_afmCombined || 0) * weights.afmCombined;
          performanceScore += weights.AS * Math.min(player.fgpi_tournamentsAttended, ACTIVITY_SCORE_CAP);
          performanceScore += weights.MAB * Math.min(player.fgpi_majorsAttended, MAJOR_ACTIVITY_BONUS_CAP);
          const af6PenaltyTerm = player.stats.AF6 === null ? AF6_INACTIVITY_PENALTY : 0;
          const afm6PenaltyTerm = player.stats.AFM6 === null ? AFM6_INACTIVITY_PENALTY : 0;
          const afm12PenaltyTerm = player.stats.AFM12 === null ? AFM12_INACTIVITY_PENALTY : 0;
          let lowActivityPenaltyTerm = 0;
          const tourneyCount = player.fgpi_tournamentsAttended;
          if (tourneyCount < 5) { lowActivityPenaltyTerm = [400, 300, 200, 100][tourneyCount - 1] || 500; }
          const penaltyDivisor = 50;
          player.rawFGPI = performanceScore - ((af6PenaltyTerm + afm6PenaltyTerm + afm12PenaltyTerm + lowActivityPenaltyTerm) / penaltyDivisor);
        });

        const rawScores = qualifiedPlayers.map(p => p.rawFGPI).filter(s => s !== null);
        const minRawFGPI = Math.min(...rawScores);
        const maxRawFGPI = Math.max(...rawScores);
        const range = maxRawFGPI - minRawFGPI;
        qualifiedPlayers.forEach(player => {
          if (player.rawFGPI === null) { player.stats.FGPI = null; }
          else if (range === 0) { player.stats.FGPI = "50.00"; }
          else {
            const normalizedScore = ((player.rawFGPI - minRawFGPI) / range) * 99.99;
            player.stats.FGPI = normalizedScore.toFixed(2);
          }
        });
      }

      const eligiblePlayers = allPlayers.filter(p => p.isQualified);

      // Only fetch StartGG socials for players that actually receive site profiles.
      let startggSocials = { players: {} };
      if (eligiblePlayers.length > 0) {
        const requestedSlugSet = new Set();
        eligiblePlayers.forEach(player => {
          const rowSlug = getStartggSlugFromRow(player._rankingRow);
          if (rowSlug) {
            requestedSlugSet.add(rowSlug);
          }
          if (player.startggSlug) {
            requestedSlugSet.add(String(player.startggSlug).toLowerCase());
          }
        });
        const requestedSlugs = Array.from(requestedSlugSet);
        if (requestedSlugs.length > 0) {
          startggSocials = await getStartggSocials({ requestedSlugs });
        }
      }

      allPlayers.forEach(player => {
        const fallbackSlug = player._baseSlug || player.slug;
        const { socials, startggSlug } = buildPlayerSocials(
          player._rankingRow,
          fallbackSlug,
          startggSocials
        );
        player.socials = socials && Object.keys(socials).length ? socials : {};
        player.startggSlug = startggSlug || player.startggSlug || null;
        delete player._rankingRow;
        delete player._baseSlug;
      });

      const statsToRank = [
        { key: 'FGPI', order: 'desc' }, { key: 'TDR', order: 'desc' }, { key: 'PF', order: 'desc' },
        { key: 'MS', order: 'desc' }, { key: 'APP', order: 'desc' }, { key: 'APM', order: 'desc' },
        { key: 'AF12', order: 'asc' }, { key: 'AF6', order: 'asc' }, { key: 'AFM12', order: 'asc' },
        { key: 'AFM6', order: 'asc' }, { key: 'V', order: 'desc' }, { key: 'T3', order: 'desc' },
        { key: 'T8', order: 'desc' }, { key: 'T16', order: 'desc' }, { key: 'PR', order: 'asc' },
        { key: 'TR', order: 'desc' }
      ];

      const EPS = 1e-9;
      const numericVal = (p, key) => {
        const v = p.stats[key];
        const n = (v === null || v === undefined) ? NaN : parseFloat(v);
        return Number.isFinite(n) ? n : null;
      };

      statsToRank.forEach(stat => {
        const withStat = eligiblePlayers
          .map(p => ({ p, val: numericVal(p, stat.key) }))
          .filter(x => x.val !== null);
        withStat.sort((a, b) => {
          const dir = stat.order === 'desc' ? -1 : 1;
          if (Math.abs(a.val - b.val) > EPS) return dir * (a.val - b.val);
          const ar = a.p.rank ?? Infinity;
          const br = b.p.rank ?? Infinity;
          if (ar !== br) return ar - br;
          return String(a.p.name).localeCompare(String(b.p.name));
        });
        let lastVal = null;
        let place = 0;
        let position = 0;
        withStat.forEach(({ p, val }) => {
          position++;
          if (lastVal === null || Math.abs(val - lastVal) > EPS) {
            place = position;
            lastVal = val;
          }
          const op = allPlayers.find(ap => ap.slug === p.slug);
          if (!op) return;
          op.statRanks = op.statRanks || {};
          op.statRanks[stat.key] = place;
        });
      });

      allPlayers.forEach(p => p.leaderRank = {});
      const getNestedValue = (obj, path) => path.split('.').reduce((o, i) => (o ? o[i] : undefined), obj);
      const statsToProcess = [
        { key: 'victories', path: 'trophies_1yr.victories', order: 'desc' },
        { key: 'top3', path: 'trophies_1yr.top3', order: 'desc' },
        { key: 'top8', path: 'trophies_1yr.top8', order: 'desc' },
        { key: 'top16', path: 'trophies_1yr.top16', order: 'desc' },
        { key: 'weeksInTop40', path: 'stats_recent.weeksInTop40', order: 'desc' },
        { key: 'avgFinish', path: 'stats_1yr.avgFinish', order: 'asc' },
        { key: 'avgFinishRecent', path: 'stats_recent.avgFinish', order: 'asc' },
        { key: 'avgFinishMajors', path: 'stats_1yr.avgFinishMajors', order: 'asc' },
      ];
      statsToProcess.forEach(stat => {
        const qualifiedPlayersWithStat = eligiblePlayers.filter(p => {
          const value = getNestedValue(p, stat.path);
          return value !== null && value !== undefined;
        });
        const sortedPlayers = [...qualifiedPlayersWithStat].sort((a, b) => {
          const valA = getNestedValue(a, stat.path) || (stat.order === 'asc' ? Infinity : 0);
          const valB = getNestedValue(b, stat.path) || (stat.order === 'asc' ? Infinity : 0);
          const primaryCompare = stat.order === 'desc' ? valB - valA : valA - valB;
          if (primaryCompare !== 0) return primaryCompare;
          return (a.rank || Infinity) - (b.rank || Infinity);
        });
        const top5Players = sortedPlayers.slice(0, 5);
        top5Players.forEach((leader, index) => {
          const originalPlayer = allPlayers.find(p => p.slug === leader.slug);
          if (originalPlayer) { originalPlayer.leaderRank[stat.key] = index + 1; }
        });
      });

      allPlayers.sort((a, b) => (a.rank || Infinity) - (b.rank || Infinity));
      allPlayers.forEach((player, index, arr) => {
        player.previousPlayer = index > 0 ? { name: arr[index - 1].name, slug: arr[index - 1].slug, rank: arr[index - 1].rank } : null;
        player.nextPlayer = index < arr.length - 1 ? { name: arr[index + 1].name, slug: arr[index + 1].slug, rank: arr[index + 1].rank } : null;
      });

      const charactersMap = {};
      allPlayers.forEach(player => {
        if (!player.mainCharacter) return;
        const charName = player.mainCharacter;
        if (!charactersMap[charName]) {
          charactersMap[charName] = { players: [] };
        }
        charactersMap[charName].players.push(player);
      });
      Object.values(charactersMap).forEach(char => {
        char.players.sort((a, b) => (a.rank || Infinity) - (b.rank || Infinity));
        char.topPlayer = char.players[0] || null;
      });
      allPlayers.forEach(player => {
        if (!player.mainCharacter) return;
        const charName = player.mainCharacter;
        player.characterTopPlayerSlug = charactersMap[charName].topPlayer?.slug || null;
      });

      // ---------- WRAPPED PAYLOAD ----------
      const payload = {
        lastUpdated: rankingsData.lastUpdated || new Date().toISOString(),
        count: allPlayers.length,
        allPlayers
      };

      // Return STRING to avoid any accidental wrapping
      return JSON.stringify(payload, null, 2);

    } catch (error) {
      console.error("❌ ERROR processing player profiles:", error);
      const fallback = {
        lastUpdated: new Date().toISOString(),
        count: 0,
        allPlayers: []
      };
      return JSON.stringify(fallback, null, 2);
    }
  }
};
