// characterAnalytics.js
"use strict";

const slugify = require("slugify");
const characterMasterList = require("./characterMasterList.js");
const sf6ArchetypeData = require("./sf6_character_archetypes.js");
const sf6MatchupData = require("./sf6_matchup_data.js");

/* ------------------------- Utilities ------------------------- */
const createSafeSlug = (name) => slugify(name || "", { lower: true, strict: true, remove: /[#<>:"/\\|?*]/g });
const safeNumber = (v, fb = 0) => (v === null || v === undefined || !isFinite(v) || isNaN(v)) ? fb : Number(v);
const parseNumeric = (v, fb = null) => { const n = parseFloat(v); return Number.isFinite(n) ? n : fb; };
const safeDivide = (n, d, fb = 0) => (d === 0 || !isFinite(d) || isNaN(d)) ? fb : safeNumber(n / d, fb);
const safeLog10 = (v, fb = 0) => (v <= 0 || !isFinite(v) || isNaN(v)) ? fb : safeNumber(Math.log10(v), fb);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function getMedian(arr) {
  if (!arr || !arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? safeDivide(s[mid - 1] + s[mid], 2, 0) : s[mid];
}

function calculateLinearRegression(pts) {
  if (!pts || pts.length < 2) return { slope: 0, intercept: 0, r2: 0 };
  const n = pts.length;
  let sX = 0, sY = 0, sXY = 0, sX2 = 0, sY2 = 0;
  pts.forEach(p => { sX += p.x; sY += p.y; sXY += p.x * p.y; sX2 += p.x * p.x; sY2 += p.y * p.y; });
  const slope = safeDivide((n * sXY - sX * sY), (n * sX2 - sX * sX), 0);
  const intercept = (sY - slope * sX) / n;
  const r2 = safeDivide(Math.pow((n * sXY - sX * sY), 2), ((n * sX2 - sX * sX) * (n * sY2 - sY * sY)), 0);
  return { slope, intercept, r2: isFinite(r2) ? r2 : 0 };
}

function calculateLinearRegressionSlope(pts) {
  if (!pts || pts.length < 2) return 0;
  const n = pts.length;
  let sX = 0, sY = 0, sXY = 0, sX2 = 0;
  pts.forEach(p => { sX += p.x; sY += p.y; sXY += p.x * p.y; sX2 += p.x * p.x; });
  return safeDivide((n * sXY - sX * sY), (n * sX2 - sX * sX), 0);
}

function winsorize(arr, loP = 0.05, hiP = 0.05) {
  if (!arr || !arr.length) return [];
  const sorted = [...arr].sort((x, y) => x - y);
  const lo = sorted[Math.floor((sorted.length - 1) * loP)];
  const hi = sorted[Math.floor((sorted.length - 1) * (1 - hiP))];
  return arr.map(v => Math.min(Math.max(v, lo), hi));
}

function weightedMean(vals, wts) {
  const n = Math.min(vals.length, wts.length);
  let wsum = 0, vsum = 0;
  for (let i = 0; i < n; i++) {
    const w = isFinite(wts[i]) ? wts[i] : 0;
    wsum += w; vsum += (isFinite(vals[i]) ? vals[i] : 0) * w;
  }
  return wsum > 0 ? vsum / wsum : null;
}

function placementToPercentile(p, e) {
  const P = safeNumber(parseInt(p, 10), 0), N = Math.max(2, safeNumber(parseInt(e, 10), 0));
  return (P <= 0 || N <= 1) ? null : ((N - P) / (N - 1)) * 100;
}

function minMaxScale(vals) {
  if (!vals || !vals.length) return { min: 0, max: 0, range: 0 };
  const min = Math.min(...vals), max = Math.max(...vals);
  return { min, max, range: max - min };
}

function buildCompetitionPositions(items, stats, tieBreaker) {
  const out = {};
  stats.forEach(({ key, order }) => {
    const desc = order === "desc";
    const entries = items.map(it => {
      const v = parseFloat(it[key]);
      return Number.isFinite(v) ? { slug: it.slug, value: v, tb: it } : null;
    }).filter(Boolean);

    entries.sort((a, b) => (a.value !== b.value) ? (desc ? b.value - a.value : a.value - b.value) : (tieBreaker ? tieBreaker(a.tb, b.tb) : 0));
    
    const posMap = {};
    let pos = 1;
    for (let i = 0; i < entries.length;) {
      const v = entries[i].value;
      let j = i + 1;
      while (j < entries.length && entries[j].value === v) j++;
      for (let k = i; k < j; k++) posMap[entries[k].slug] = pos;
      pos += (j - i);
      i = j;
    }
    out[key] = posMap;
  });
  return out;
}

function assignPlayerDataToCharacters(analytics, profiles) {
  const pMap = {};
  profiles
    .map(p => ({ ...p, rank: Number(p.rank) || Infinity, main: (p.mainCharacter || "").trim() }))
    .filter(p => p.main && p.rank > 0 && p.rank !== Infinity)
    .sort((a, b) => a.rank - b.rank)
    .forEach(p => {
      const s = createSafeSlug(p.main);
      if (!pMap[s]) pMap[s] = [];
      pMap[s].push(p);
    });

  analytics.forEach(c => {
    const players = pMap[c.slug] || [];
    const top = players[0];
    c.topPlayer = top ? {
      name: top.name || "Unknown", rank: top.rank, slug: top.slug,
      country: top.countryCode || top.country, photoUrl: top.photoUrl || "",
      initials: (top.name || "").split(" ").map(n => n[0]).join("")
    } : { name: "N/A", rank: null, slug: null };

    c.notablePlayers = players.slice(0, 3).map(p => ({
      name: p.name, englishName: p.englishName, rank: p.rank, slug: p.slug,
      country: p.countryCode || p.country, photoUrl: p.photoUrl || ""
    }));
  });
  return analytics;
}

const calculateConfidence = (n, trustThreshold = 10, steepness = 0.35) => {
    if (!n || n === 0) return 0;
    return 1 / (1 + Math.exp(-steepness * (n - trustThreshold)));
};

/* ---------------------- Main Logic ---------------------- */
module.exports = async function () {
  try {
    console.log("Starting Advanced Character Analytics System Generation...");

    const [rankings, tournaments, profiles] = await Promise.all([
      require("./rankings.js")(),
      require("./tournaments.js")(),
      require("./playerProfiles.js")()
    ]);

    const allPlayers = rankings.players;
    const allTournaments = tournaments.events;
    const profilesMap = new Map(profiles.map(p => [p.name, p]));
    const now = new Date();
    const oneYearAgo = new Date(new Date(now).setFullYear(now.getFullYear() - 1));

    // --- CONFIGURATION ---
    const PLACEMENT_POINTS = { "S+": 1.2, "S": 0.9, "A": 0.6, "B": 0.3 };
    const TS_USAGE_THRESHOLD = 10;
    const TWE_CREDIBILITY_K = 10;
    const PF_TIER_WEIGHTS = { "S+": 1.0, "S": 0.95, "A": 0.85, "B": 0.75 };
    
    // CPF Config
    const CPF_MIN_ENTRANTS = 32, CPF_MIN_RESULTS = 5, CPF_WORST_Q = 0.33;
    const CPF_K_BASE = 16, CPF_K_TINY_MULT = 3.0;
    const CPF_WINSOR_LO = 0.10, CPF_WINSOR_HI = 0.0; 
    const CPF_UNCERT_PENALTY = 0.6, CPF_DIVERSITY_K = 6;
    const T3R_ALPHA0 = 2, T3R_BETA0 = 6;

    const getDecayMultiplier = (date) => {
      const d = new Date(date);
      if (isNaN(d.getTime())) return 0.0;
      const diffMonths = Math.abs(now - d) / (1000 * 60 * 60 * 24 * 30.44);
      return diffMonths >= 12 ? 0.0 : Math.pow(0.85, diffMonths);
    };

    /* --- Build Player Data --- */
    const playersMap = new Map();
    allPlayers.forEach(p => {
      if (!p?.["Player"] || !p?.["Main Character"]) return;
      const prof = profilesMap.get(p.Player);
      const name = prof?.name || p.Player;
      const fgpi = parseNumeric(prof?.rawFGPI) ?? parseNumeric(prof?.fgpiNormalized) ?? parseNumeric(p.FGPI);

      playersMap.set(p.Player, {
        name, slug: prof?.slug || createSafeSlug(name),
        mainCharacter: p["Main Character"],
        CountryCode: (prof?.countryCode || prof?.country || p.Country || "").toString().trim().toUpperCase() || null,
        rawFgpiScore: fgpi,
        MS: safeNumber(parseNumeric(prof?.stats?.MS), 0),
        PF: safeNumber(parseNumeric(prof?.stats?.PF), 0),
        normalizedFGPI: 0, results: [], qualifiedResultsCount: 0
      });
    });

    allTournaments.forEach(evt => {
      if (!evt?.date || !Array.isArray(evt.results)) return;
      const d = new Date(evt.date);
      if (isNaN(d.getTime()) || d < oneYearAgo) return;
      
      evt.results.forEach(r => {
        const pl = playersMap.get(r.Player);
        if (pl) {
          pl.results.push({
            date: d, tier: evt.Tier || "C",
            placement: safeNumber(parseInt(r.Finish, 10), 9999),
            entrants: Math.max(1, safeNumber(parseInt(evt.Entrants, 10), 64)),
            slug: evt.slug || "unknown"
          });
          if (evt.Tier) pl.qualifiedResultsCount++;
        }
      });
    });

    /* --- Event Strength & FGPI Estimation --- */
    const eventStrengthMap = new Map();
    
    const estimateFgpi = (pl) => {
      const res = pl?.results || [];
      if (!res.length) return null;
      let wSum = 0, totW = 0, majors = 0;
      res.forEach(r => {
        const pct = placementToPercentile(r.placement, r.entrants);
        if (pct === null) return;
        const w = Math.max(0.1, (PF_TIER_WEIGHTS[r.tier] ?? 0.5) * (eventStrengthMap.get(r.slug) ?? 1.0));
        wSum += pct * w; totW += w;
        if (r.tier === "S" || r.tier === "S+") majors++;
      });
      if (totW <= 0) return null;
      const raw = wSum / totW;
      const qual = 0.3 + 0.7 * (majors / res.length);
      return clamp(5 + (totW / (totW + 10)) * qual * (raw - 5), 5, 60);
    };

    const calcPerf = (res) => {
      const scores = res.map(r => {
        const evt = allTournaments.find(t => t.slug === r.slug);
        const str = (evt && Number.isFinite(evt.strengthMultiplier)) ? evt.strengthMultiplier : 1.0;
        const base = PLACEMENT_POINTS[r.tier] || 0.2;
        let val = base * 0.25;
        if (r.placement === 1) val = base * 4;
        else if (r.placement <= 3) val = base * 3;
        else if (r.placement <= 8) val = base * 2;
        else if (r.placement <= 16) val = base * 1;
        else if (r.placement <= 32) val = base * 0.5;
        return safeNumber(val * getDecayMultiplier(r.date) * str, 0);
      });
      return safeDivide(scores.reduce((a, b) => a + b, 0), scores.length, 0);
    };

    playersMap.forEach(p => { if (!Number.isFinite(p.rawFgpiScore)) p.rawFgpiScore = estimateFgpi(p) ?? 0; });

    const fgpiVals = Array.from(playersMap.values()).map(p => p.rawFgpiScore).filter(v => Number.isFinite(v));
    const fgpiScale = minMaxScale(fgpiVals);
    playersMap.forEach(p => {
      p.normalizedFGPI = fgpiVals.length ? (fgpiScale.range > 0.001 ? safeDivide((p.rawFgpiScore - fgpiScale.min) * 99.99, fgpiScale.range, 50) : 50) : 50;
    });

    const recomputeStrengths = () => {
      eventStrengthMap.clear();
      const strs = [];
      allTournaments.forEach(evt => {
        const ent = Math.max(1, safeNumber(parseInt(evt.Entrants, 10), 64));
        let wSum = 0, tot = 0;
        evt.results.slice(0, 32).forEach(r => {
          const pl = playersMap.get(r.Player);
          if (pl) {
            const wt = Math.min(pl.results.length, 5) / 5;
            wSum += (Number.isFinite(pl.normalizedFGPI) ? pl.normalizedFGPI : 50) * wt;
            tot += wt;
          }
        });
        const s = safeLog10(ent) * (tot > 0 ? wSum / tot : 40);
        evt.strength = s;
        strs.push(s);
      });
      
      const posS = strs.filter(s => s > 0);
      const sScale = minMaxScale(posS);
      allTournaments.forEach(evt => {
        const r = sScale.range > 0 ? safeDivide(evt.strength - sScale.min, sScale.range, 0) : 0;
        const m = Math.max(0.1, sScale.range > 0 ? 0.5 + Math.max(0, Math.min(1, r)) : 1.0);
        evt.strengthMultiplier = m;
        if (evt.slug) eventStrengthMap.set(evt.slug, m);
      });
    };
    recomputeStrengths();

    const pPerf = new Map();
    playersMap.forEach(p => pPerf.set(p.name, calcPerf(p.results)));

    const allPerf = Array.from(pPerf.values()).filter(s => s > 0).sort((a, b) => a - b);
    const floor = allPerf[Math.floor(allPerf.length * 0.40)] || 0;

    const expPoints = [];
    playersMap.forEach(p => {
      const perf = pPerf.get(p.name);
      if (perf !== undefined && p.normalizedFGPI !== undefined) expPoints.push({ x: p.normalizedFGPI, y: perf });
    });
    const expModel = calculateLinearRegression(expPoints);
    console.log(`Expectation Model: y=${expModel.slope.toFixed(4)}x + ${expModel.intercept.toFixed(4)}`);

    /* --- Character Aggregation --- */
    const charMap = new Map();
    characterMasterList.forEach(c => charMap.set(c.name, {
      name: c.name, slug: createSafeSlug(c.name), players: [],
      totalFGPI: 0, fgpiWeightedSum: 0, fgpiWeight: 0, allResults: [], uniqueEvents: new Set()
    }));

    Array.from(playersMap.values()).filter(p => p.qualifiedResultsCount >= 1).forEach(p => {
      const c = charMap.get(p.mainCharacter);
      if (c) {
        c.players.push(p);
        c.allResults.push(...p.results);
        p.results.forEach(r => { if (r && (r.tier === "S+" || r.tier === "S")) c.uniqueEvents.add(r.slug); });
      }
    });

    const charsWithP = Array.from(charMap.values()).filter(c => c.players.length);
    const pCounts = charsWithP.map(c => c.players.length);
    const pScale = minMaxScale(pCounts);

    const analytics = [];
    charMap.forEach(cd => {
      if (cd.players.length) {
        const pDeltas = [], pFgpi = [];
        let dV = 0, dT3 = 0, dT8 = 0, dT16 = 0;
        let mV = 0, mT3 = 0, mT8 = 0, mT16 = 0, dMV = 0, dMT3 = 0, dMT8 = 0, dMT16 = 0;

        // --- NEW: Decay-Aware Threat Tracker ---
        let decayedThreatScore = 0;

        cd.players.forEach(p => {
          pFgpi.push(p.normalizedFGPI);
          cd.totalFGPI += p.normalizedFGPI;
          const w = Math.min(p.results.length, 5) / 5;
          cd.fgpiWeightedSum += p.normalizedFGPI * w;
          cd.fgpiWeight += w;
          const exp = Math.max((expModel.slope * p.normalizedFGPI) + expModel.intercept, floor);
          pDeltas.push((pPerf.get(p.name) || 0) - exp);
        });

        cd.allResults.forEach(r => {
          const isMaj = r.tier === "S+" || r.tier === "S";
          const isDisp = isMaj || r.tier === "A" || r.tier === "B";
          const dec = getDecayMultiplier(r.date);
          const tw = PLACEMENT_POINTS[r.tier] || 0.2;
          
          if (isMaj) {
            if (r.placement === 1) { mV++; dMV += dec * tw; }
            if (r.placement <= 3) { mT3++; dMT3 += dec * tw; }
            if (r.placement <= 8) { mT8++; dMT8 += dec * tw; }
            if (r.placement <= 16) { mT16++; dMT16 += dec * tw; }
            
            // Calculate Decayed Threat Points specifically for CPV
            let pts = 0;
            if (r.placement === 1) pts = 50;
            else if (r.placement <= 3) pts = 25;
            else if (r.placement <= 8) pts = 10;
            else if (r.placement <= 16) pts = 5;
            
            if (pts > 0) decayedThreatScore += (pts * dec);
          }
          
          if (isDisp) {
            if (r.placement === 1) dV += dec * tw;
            if (r.placement <= 3) dT3 += dec * tw;
            if (r.placement <= 8) dT8 += dec * tw;
            if (r.placement <= 16) dT16 += dec * tw;
          }
        });

        // T3R
        const t3n = dMT3 + dMT8 + dMT16;
        const bayes = ((T3R_ALPHA0 + dMT3) / (T3R_ALPHA0 + dMT3 + T3R_BETA0 + Math.max(0, t3n - dMT3))) * 100;
        const ue = cd.uniqueEvents.size;
        const T3R = (t3n > 0 && ue > 0) ? bayes * (ue / (ue + TWE_CREDIBILITY_K)) : null;

        // TS (Weighted)
        const perfS_plus = calcPerf(cd.allResults.filter(r => r.tier === "S+"));
        const perfS = calcPerf(cd.allResults.filter(r => r.tier === "S"));
        const perfA = calcPerf(cd.allResults.filter(r => r.tier === "A"));
        const perfB = calcPerf(cd.allResults.filter(r => r.tier === "B"));
        
        const tsPts = [];
        if (perfB > 0) tsPts.push({ x: 1, y: perfB });
        if (perfA > 0) tsPts.push({ x: 2, y: perfA });
        if (perfS > 0) tsPts.push({ x: 3, y: perfS * 1.25 });
        if (perfS_plus > 0) tsPts.push({ x: 4, y: perfS_plus * 1.5 });

        const rawTS = tsPts.length >= 2 ? calculateLinearRegressionSlope(tsPts) : (tsPts.length === 1 ? (tsPts[0].x - 2.5) * 0.1 : 0);
        const highTierP = cd.players.filter(p => p.results.some(r => ["B","A","S","S+"].includes(r.tier))).length;
        const tiersRep = new Set(tsPts.map(p => p.x)).size;
        const partFact = safeDivide(safeLog10(1 + highTierP), safeLog10(1 + TS_USAGE_THRESHOLD), 0);
        const TS = rawTS * Math.max(0.25, Math.min(1, partFact)) * (tiersRep >= 2 ? (tiersRep - 1) / 3 : 0.33) * 100;

        // CPF
        const cpfVals = [], cpfWts = [];
        cd.allResults.forEach(r => {
          if (!r.entrants || r.entrants < CPF_MIN_ENTRANTS) return;
          const pct = placementToPercentile(r.placement, r.entrants);
          if (pct !== null) {
            cpfVals.push(pct * (PF_TIER_WEIGHTS[r.tier] ?? 0.75));
            cpfWts.push(Math.max(0.25, eventStrengthMap.get(r.slug) ?? 1.0));
          }
        });
        
        let cpfObs = null, cpfStd = 0, cpfN = cpfVals.length;
        if (cpfN >= 2) {
          const idcs = [...cpfVals.keys()].sort((i, j) => cpfVals[i] - cpfVals[j]).slice(0, Math.max(2, Math.ceil(CPF_WORST_Q * cpfN)));
          const wVals = winsorize(idcs.map(i => cpfVals[i]), CPF_WINSOR_LO, CPF_WINSOR_HI);
          cpfObs = weightedMean(wVals, idcs.map(i => cpfWts[i]));
          const mu = cpfObs ?? 0;
          const vSum = wVals.reduce((s, x) => s + Math.pow(x - mu, 2), 0);
          cpfStd = wVals.length > 1 ? Math.sqrt(vSum / (wVals.length - 1)) : 0;
        } else if (cpfN === 1) { cpfObs = cpfVals[0]; }

        // CMS & RDI
        const monSc = Array.from({ length: 12 }, () => []);
        const regSc = { NA:[], EU:[], AS:[], ME:[], SA:[], OC:[], AF:[], Other:[] };
        const REGIONS = { NA:["US","CA","MX","DR","PR","PA","CR","TT"], EU:["GB","FR","DE","ES","IT","SE","NO","FI","NL","BE","CH","AT","PT","GR","PL","DK","IE","RU","CZ"], AS:["JP","KR","CN","TW","HK","SG","TH","PH","MY","IN","VN"], ME:["AE","SA","KW","JO","BH","OM","QA","LB","IL"], SA:["BR","CL","AR","PE","CO","VE","UY","EC"], OC:["AU","NZ"], AF:["CM","MA","ZA","EG"] };
        const getReg = (cc) => {
           const c = (cc||"").trim().toUpperCase();
           return Object.keys(REGIONS).find(k => REGIONS[k].includes(c)) || "Other";
        };

        cd.players.forEach(p => {
          const perf = pPerf.get(p.name) || 0;
          regSc[getReg(p.CountryCode)].push(perf);
          p.results.forEach(r => {
             const m = now.getMonth() - r.date.getMonth() + (12 * (now.getFullYear() - r.date.getFullYear()));
             if (m >= 0 && m < 12) monSc[m].push(calcPerf([r]));
          });
        });

        const cmsPts = [];
        for (let i = 0; i < 12; i++) if (monSc[i].length) cmsPts.push({ x: 12 - i, y: getMedian(monSc[i]) });
        let CMS = 0;
        if (cmsPts.length >= 2) {
           const wy = winsorize(cmsPts.map(p => p.y), 0.1, 0.1);
           CMS = calculateLinearRegressionSlope(cmsPts.map((p, i) => ({ x: p.x, y: wy[i] }))) * 100;
        }

        let topReg = null, topRegSc = 0;
        for (const r in regSc) {
          const scs = regSc[r].sort((a, b) => b - a);
          if (scs.length) {
            const topN = scs.slice(0, 5);
            const score = (topN.reduce((a,b)=>a+b,0) / topN.length) + (Math.log10(scs.length) * 0.02);
            if (score > topRegSc) { topRegSc = score; topReg = r; }
          }
        }

        const pl3 = cd.allResults.filter(r => (now - r.date) < (1000 * 60 * 60 * 24 * 90)).map(r => r.placement);

        analytics.push({
          name: cd.name, slug: cd.slug, hasData: true,
          playerDeltas: pDeltas, totalPerf: calcPerf(cd.allResults),
          V: dV, T3: dT3, T8: dT8, T16: dT16, displayV: dV, displayT3: dT3, displayT8: dT8, displayT16: dT16,
          MajorV: mV, MajorT3: mT3, MajorT8: mT8, MajorT16: mT16,
          decayedThreatScore, // --- NEW: Passing this forward
          TS, timeWeightedTWE: T3R, _cpfObs: cpfObs, _cpfStd: cpfStd, _cpfN: cpfN,
          CMS: parseFloat(CMS.toFixed(2)), topRegionRaw: topReg, topRegionScoreRaw: topRegSc, placements3mo: pl3
        });
      } else {
        analytics.push({ name: cd.name, slug: cd.slug, hasData: false });
      }
    });

    /* --- Ranking & X-Factor Prep --- */
    const ranked = analytics.filter(c => c.hasData);
    ranked.forEach((c, i) => {
      c.xFactor = getMedian(c.playerDeltas);
    });

    /* --- Final Object Assembly (ROBUST CPV LOGIC) --- */
    const final = [];
    const REG_NAMES = { NA: "North America", EU: "Europe", AS: "Asia", ME: "Middle East", SA: "South America", OC: "Oceania", AF: "Africa", Other: "Other" };

    ranked.forEach(d => {
      const rec = charMap.get(d.name);
      const count = rec.players.length;
      
      // 1. FGPI (Player Strength)
      const fgpiSum = rec.fgpiWeight > 0 ? safeDivide(rec.fgpiWeightedSum, rec.fgpiWeight, 0) : safeDivide(rec.totalFGPI, count, 0);
      
      // 2. Stats Calculation
      const AF3 = d.placements3mo.length ? parseFloat(safeDivide(d.placements3mo.reduce((a,b)=>a+b,0), d.placements3mo.length, 0).toFixed(2)) : null;
      const AF12 = rec.allResults.length ? parseFloat(safeDivide(rec.allResults.map(r=>r.placement).reduce((a,b)=>a+b,0), rec.allResults.length, 0).toFixed(2)) : null;

      // --- CPV Calculation Logic ---

      // A. Peak Performance (The Ceiling) - Top 3 Average
      const top3FGPI = [...rec.players].map(p => p.normalizedFGPI).sort((a, b) => b - a).slice(0, 3);
      const peakScore = top3FGPI.length ? (top3FGPI.reduce((a, b) => a + b, 0) / top3FGPI.length) : 0;

      // B. Efficiency (Points Per Entrant)
      const efficiency = safeDivide(d.totalPerf, count, 0);

      // C. Tournament Threat (Decayed)
      // We now use the time-decayed threat sum we calculated in the main loop
      const threatScore = d.decayedThreatScore || 0;
      
      // D. Raw Values (Stored for Normalization)
      d._rawPeak = peakScore;
      d._rawEff = efficiency;
      d._rawThreat = Math.log10(threatScore + 10); // Log scale dampens outliers
      d._rawXF = d.xFactor;

      // E. Confidence (Sigmoid)
      const confidence = calculateConfidence(count, 10, 0.35); 
      
      // Viability Multiplier
      d._viabilityMult = 0.40 + (0.60 * confidence);

      final.push({
        ...d,
        FGPI: parseFloat(fgpiSum.toFixed(2)), 
        TP: 0,
        AF3, AF12,
        TWE: d.timeWeightedTWE !== null ? parseFloat(d.timeWeightedTWE.toFixed(2)) : null,
        historicalTWE: parseFloat(safeDivide(d.MajorV * 100, Math.max(1, d.MajorT3 + d.MajorT8 + d.MajorT16), 0).toFixed(2)),
        primaryRDI: d.topRegionRaw ? { region: REG_NAMES[d.topRegionRaw] || d.topRegionRaw, score: parseFloat(d.topRegionScoreRaw.toFixed(6)) } : null,
        primaryRDI_score: d.topRegionScoreRaw,
        tsComponents: { rawTS: d.TS }
      });
    });

    // --- Relative Scaling & Final CPV ---
    const getSc = (k) => minMaxScale(final.map(x => x[k]));
    const scPeak = getSc('_rawPeak');
    const scEff = getSc('_rawEff');
    const scThreat = getSc('_rawThreat');
    const scXF = getSc('_rawXF');

    final.forEach(c => {
        // Normalize 0-100
        const nPeak = scPeak.range > 0 ? ((c._rawPeak - scPeak.min) / scPeak.range) * 100 : 0;
        const nEff = scEff.range > 0 ? ((c._rawEff - scEff.min) / scEff.range) * 100 : 0;
        const nThreat = scThreat.range > 0 ? ((c._rawThreat - scThreat.min) / scThreat.range) * 100 : 0;
        const nXF = scXF.range > 0 ? ((c._rawXF - scXF.min) / scXF.range) * 100 : 50;

        // 40% Peak, 25% Threat, 20% Efficiency, 15% X-Factor
        const rawCPV = (nPeak * 0.40) + (nThreat * 0.25) + (nEff * 0.20) + (nXF * 0.15);

        // Apply Confidence
        c.CPV = parseFloat((rawCPV * c._viabilityMult).toFixed(2));
        
        // TP Visual
        const rec = charMap.get(c.name);
        c.TP = pScale.range > 0 ? Math.round(((rec.players.length - pScale.min) / pScale.range) * 100) : 0;

        delete c._rawPeak; delete c._rawEff; delete c._rawThreat; delete c._rawXF; delete c._viabilityMult; delete c.playerDeltas; delete c.topRegionRaw; delete c.topRegionScoreRaw; delete c.decayedThreatScore;
    });

    const unranked = analytics.filter(c => !c.hasData).map(c => ({
      name: c.name, slug: c.slug, hasData: false, CPV: null, Tier: "D", 
      CMS: null, CPF: null, FGPI: null, TP: null, TWE: null, historicalTWE: 0,
      AF3: null, AF12: null, V: 0, T3: 0, T8: 0, T16: 0, MajorV: 0, MajorT3: 0, MajorT8: 0, MajorT16: 0, TS: null,
      displayV: 0, displayT3: 0, displayT8: 0, displayT16: 0, tsComponents: {}, primaryRDI: null
    }));

    /* --- CPF Shrinkage --- */
    const obsCPF = final.map(c => (c._cpfObs != null && c._cpfN > 0) ? c._cpfObs : null).filter(v => v != null);
    const gCPF = obsCPF.length ? safeDivide(obsCPF.reduce((a,b)=>a+b,0), obsCPF.length, 50) : 50;
    
    final.forEach(c => {
      if (c._cpfObs != null && c._cpfN > 0) {
        const K = (c._cpfN < CPF_MIN_RESULTS ? CPF_K_BASE * CPF_K_TINY_MULT : CPF_K_BASE) * (1 + 1/Math.sqrt(c._cpfN));
        const pen = clamp(c._cpfObs - CPF_UNCERT_PENALTY * (c._cpfN > 0 ? c._cpfStd / Math.sqrt(c._cpfN) : 0), 0, 100);
        const w = c._cpfN / (c._cpfN + K);
        let s = w * pen + (1 - w) * gCPF;
        const divW = c._cpfN / (c._cpfN + CPF_DIVERSITY_K);
        s = s * divW + gCPF * (1 - divW);
        if (c._cpfN < CPF_MIN_RESULTS) s = Math.min(s, gCPF);
        c.CPF = parseFloat(clamp(s, 0, 100).toFixed(2));
      } else c.CPF = null;
      delete c._cpfObs; delete c._cpfStd; delete c._cpfN;
    });

    const scaleMetric = (list, key, maxVal) => {
      const vals = list.map(x => x[key]).filter(v => Number.isFinite(v));
      const sc = minMaxScale(vals);
      list.forEach(c => {
        if (Number.isFinite(c[key])) {
          c[key] = parseFloat((sc.range > 0.001 ? Math.min(maxVal, Math.max(0, ((c[key] - sc.min) / sc.range) * maxVal)) : maxVal).toFixed(2));
        }
      });
    };
    scaleMetric(final, 'CPV', 99.99);
    scaleMetric(final, 'primaryRDI_score', 100);
    final.forEach(c => { if(c.primaryRDI && c.primaryRDI_score !== undefined) c.primaryRDI.score = c.primaryRDI_score; });

    // Tiering
    if (final.length) {
      const vals = final.map(c => c.CPV).filter(v => Number.isFinite(v));
      const wV = winsorize(vals, 0.02, 0.02);
      const m = wV.reduce((a,b)=>a+b,0)/wV.length;
      const sd = Math.sqrt(wV.reduce((s,x)=>s+(x-m)**2,0)/Math.max(1, wV.length-1)) || 1;
      
      const zS=0.85, zA=0.25;
      final.forEach(c => {
        const z = Number.isFinite(c.CPV) ? (c.CPV - m)/sd : -Infinity;
        if(z>=zS) c.Tier = (c.MajorT3 >= 1) ? "S" : "A"; 
        else if(z>=zA) c.Tier = "A";
        else if(z>=-zA) c.Tier = "B";
        else if(z>=-zS) c.Tier = "C";
        else c.Tier = "D";
      });
    }

    final.sort((a,b) => (b.CPV||-1)-(a.CPV||-1) || (b.MajorV||0)-(a.MajorV||0) || (b.T8||0)-(a.T8||0));
    let finalOut = [...final, ...unranked];

    finalOut = finalOut.map(c => ({
      ...c, ...(sf6ArchetypeData[c.slug]||{}), ...(sf6MatchupData[c.slug]||sf6MatchupData.default||{}),
      radar_stats: sf6ArchetypeData[c.slug]?.radar_stats || null
    }));

    finalOut = assignPlayerDataToCharacters(finalOut, profiles);

    // Ranks
    const rCounts = {};
    finalOut.forEach(c => { if(c.primaryRDI?.region) rCounts[c.primaryRDI.region] = (rCounts[c.primaryRDI.region]||0)+1; });
    finalOut.forEach(c => { c.primaryRDI_count = c.primaryRDI?.region ? rCounts[c.primaryRDI.region] : 0; });

    const pos = buildCompetitionPositions(finalOut, [
      { key: "CPV", order: "desc" }, { key: "CMS", order: "desc" }, { key: "TWE", order: "desc" }, 
      { key: "FGPI", order: "desc" }, { key: "CPF", order: "desc" }, { key: "TS", order: "desc" }, 
      { key: "TP", order: "desc" }, { key: "primaryRDI_count", order: "desc" },
      { key: "AF12", order: "asc" }, { key: "AF3", order: "asc" },
      { key: "MajorV", order: "desc" }, { key: "MajorT3", order: "desc" }, { key: "T8", order: "desc" }, { key: "T16", order: "desc" }
    ], (a,b) => (b.CPV||-1)-(a.CPV||-1) || (b.MajorV||0)-(a.MajorV||0) || (a.name||"").localeCompare(b.name||""));

    const rankLook = (slug, key) => { const v = pos[key]?.[slug]; return (v && v <= 5) ? v : null; };
    finalOut.forEach(c => {
      c.statRanks = { CPV: rankLook(c.slug,'CPV'), CMS: rankLook(c.slug,'CMS'), TWE: rankLook(c.slug,'TWE'), FGPI: rankLook(c.slug,'FGPI'), CPF: rankLook(c.slug,'CPF'), TS: rankLook(c.slug,'TS'), TP: rankLook(c.slug,'TP'), primaryRDI: rankLook(c.slug,'primaryRDI_count'), AF12: rankLook(c.slug,'AF12'), AF3: rankLook(c.slug,'AF3') };
      c.leaderRank = { victories: rankLook(c.slug,'MajorV'), top3: rankLook(c.slug,'MajorT3'), top8: rankLook(c.slug,'T8'), top16: rankLook(c.slug,'T16') };
    });

    const unique = new Map();
    finalOut.forEach(c => { if(!unique.has(c.slug)) unique.set(c.slug, c); });
    console.log(`✅ Generated ${unique.size} character records.`);
    return Array.from(unique.values());

  } catch (err) { console.error("❌ CRITICAL ERROR:", err); return []; }
};