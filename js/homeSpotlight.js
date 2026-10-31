document.addEventListener('DOMContentLoaded', () => {
  const spotlightTarget = document.querySelector('#spotlight-placement-target');
  if (!spotlightTarget) return;

  const CACHE_KEY = 'fgc_live_sheet_csv_v1';
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  function toNum(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(String(v).trim());
    return Number.isFinite(n) ? n : null;
  }

  function slug(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function normName(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '');
  }

  function extract6MValue(p) {
    if (!p || typeof p !== 'object') return null;
    const direct =
      p.ratingChange6M ??
      p.ratingChange6m ??
      p['6M Rating Change'] ??
      p['Rating Change 6M'] ??
      p.rankChange6m ??
      p.rankChange6M ??
      p.change6M ??
      p.change6m ??
      p.sixMonthChange ??
      p.sixMonthRatingChange ??
      p.sixMonthRankChange ??
      p['6M Rank Change'] ??
      p['6M Change'] ??
      p['6mChange'] ??
      p['6M'];

    if (direct !== undefined && direct !== null && direct !== '—') return direct;

    for (const k of Object.keys(p)) {
      if (/6m|sixmonth/i.test(k) && p[k] !== undefined && p[k] !== null && p[k] !== '—') {
        return p[k];
      }
    }
    return null;
  }

  function parseLiveSheetCSV(csvText) {
    const rows = [];
    let row = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
      const ch = csvText[i];
      const next = csvText[i + 1];

      if (inQuotes) {
        if (ch === '"' && next === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          cur += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          row.push(cur.trim());
          cur = '';
        } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
          if (ch === '\r') i++;
          row.push(cur.trim());
          if (row.some((cell) => cell !== '')) rows.push(row);
          row = [];
          cur = '';
        } else if (ch !== '\r') {
          cur += ch;
        }
      }
    }
    if (cur.length > 0 || row.length > 0) {
      row.push(cur.trim());
      if (row.some((cell) => cell !== '')) rows.push(row);
    }

    if (rows.length < 2) return new Map();

    const headers = rows[0].map((h, idx) => (h === '' && idx === 0 ? 'Rank' : h));
    const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const findColIdx = (candidates) => {
      const targets = candidates.map(norm);
      return headers.findIndex((h) => targets.includes(norm(h)));
    };

    const rankIdx = findColIdx(['Rank']);
    const playerIdx = findColIdx(['Player', 'Name']);
    const engNameIdx = findColIdx(['English Name', 'EnglishName']);
    const countryIdx = findColIdx(['Country', 'Region']);
    const charIdx = findColIdx(['Main Character', 'Character', 'Main']);
    const rankChgIdx = findColIdx(['Rank Change', 'RankChange']);
    let chg6mIdx = findColIdx([
      'Rating Change 6M',
      '6M Rating Change',
      '6M Rank Change',
      'Rank Change 6M',
      '6M Change',
      '6M'
    ]);

    const parseCleanNum = (v) => {
      if (v === undefined || v === null) return null;
      const cleaned = String(v)
        .replace(/[\u2212\u2013\u2014]/g, '-')
        .replace(/[,\s+]/g, '')
        .trim();
      if (!cleaned || cleaned === '-' || cleaned === '—' || /^n\/?a$/i.test(cleaned)) return null;
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : null;
    };

    if (chg6mIdx === -1) {
      const hasNumbersInCol = (colIndex) =>
        rows.slice(1, 15).some((r) => parseCleanNum(r[colIndex]) !== null);
      if (hasNumbersInCol(10)) chg6mIdx = 10;
      else if (hasNumbersInCol(9)) chg6mIdx = 9;
    }

    const liveMap = new Map();
    for (let r = 1; r < rows.length; r++) {
      const cols = rows[r];
      const pName = playerIdx >= 0 ? cols[playerIdx] : '';
      if (!pName) continue;

      const engName = engNameIdx >= 0 ? cols[engNameIdx] : '';
      const rankVal = rankIdx >= 0 ? parseCleanNum(cols[rankIdx]) : r;
      const raw6m = chg6mIdx >= 0 ? cols[chg6mIdx] : null;
      const num6m = parseCleanNum(raw6m);

      const payload = {
        rank: rankVal ?? r,
        rankChange: rankChgIdx >= 0 ? cols[rankChgIdx] : null,
        rankChange6m: num6m,
        country: countryIdx >= 0 ? cols[countryIdx] : null,
        mainCharacter: charIdx >= 0 ? cols[charIdx] : null
      };

      const kName = normName(pName);
      const kEng = normName(engName);
      const kSlug = slug(engName || pName);

      if (kName) liveMap.set(kName, payload);
      if (kEng) liveMap.set(kEng, payload);
      if (kSlug) liveMap.set(kSlug, payload);
    }
    return liveMap;
  }

  function applyLiveSheet(profiles, csvText) {
    if (!csvText || !Array.isArray(profiles)) return false;
    const liveMap = parseLiveSheetCSV(csvText);
    if (!liveMap.size) return false;

    profiles.forEach((p) => {
      const live =
        liveMap.get(normName(p.name)) ||
        liveMap.get(normName(p.englishName)) ||
        liveMap.get(String(p.slug || '').toLowerCase());
      if (live) {
        if (live.rank !== null) p.rank = live.rank;
        if (live.rankChange !== null) p.rankChange = live.rankChange;
        if (live.rankChange6m !== null) {
          p.rankChange6m = live.rankChange6m;
          p.ratingChange6m = live.rankChange6m;
        }
        if ((!p.country || p.country === 'N/A') && live.country && live.country !== 'N/A') {
          p.country = live.country;
        }
        if ((!p.mainCharacter || p.mainCharacter === 'N/A') && live.mainCharacter && live.mainCharacter !== 'N/A') {
          p.mainCharacter = live.mainCharacter;
        }
      }
    });
    return true;
  }

  function parseRankChange(change) {
    const out = { signed: 0, isNew: false };
    if (change == null) return out;
    if (typeof change === 'number') {
      out.signed = Number.isFinite(change) ? change : 0;
      return out;
    }
    const s = String(change)
      .replace(/[\u2212\u2013\u2014]/g, '-')
      .replace(/,/g, '')
      .trim()
      .toLowerCase();
    if (!s || s === '—' || s === '-' || s === '0') return out;
    if (s === 'new' || s === '+new' || s === 'new!') {
      out.isNew = true;
      out.signed = 999;
      return out;
    }
    const signedNum = s.match(/^([+-]?)\s*(\d+(?:\.\d+)?)$/);
    if (signedNum) {
      out.signed = (signedNum[1] === '-' ? -1 : 1) * parseFloat(signedNum[2]);
      return out;
    }
    const upPhrase = s.match(/(?:up|rise|gained|gain|climb|climbed)\s+(\d+(?:\.\d+)?)/);
    if (upPhrase) {
      out.signed = parseFloat(upPhrase[1]);
      return out;
    }
    const downPhrase = s.match(/(?:down|fell|fall|drop|dropped|declined)\s+(\d+(?:\.\d+)?)/);
    if (downPhrase) {
      out.signed = -parseFloat(downPhrase[1]);
      return out;
    }
    const anyNum = s.match(/([+-]?\d+(?:\.\d+)?)/);
    if (anyNum) out.signed = parseFloat(anyNum[1]);
    return out;
  }

  function createSpotlightCardHTML(player, statHTML) {
    const r = toNum(player.rank);
    const rankClass = r >= 6 && r <= 20 ? 'ranked-6-20' : `rank-${r ?? ''}`;

    let rankIcon = '';
    const rankNum = parseInt(player.rank, 10);
    if (rankNum === 1) rankIcon = '<i class="fas fa-trophy trophy-1" aria-label="1st"></i>';
    else if (rankNum === 2) rankIcon = '<i class="fas fa-trophy trophy-2" aria-label="2nd"></i>';
    else if (rankNum === 3) rankIcon = '<i class="fas fa-trophy trophy-3" aria-label="3rd"></i>';
    else if (rankNum === 4) rankIcon = '<i class="fas fa-medal medal-4" aria-label="4th"></i>';

    const playerDisplayName = player.englishName ? `${player.name} (${player.englishName})` : player.name;
    const characterInfo = player.mainCharacter
      ? `<div class="spotlight-v2__info-item"><i class="fas fa-user-ninja"></i> ${player.mainCharacter}</div>`
      : '';
    const countryInfo = player.country
      ? `<div class="spotlight-v2__info-item"><img src="/images/flags/${String(player.country).toLowerCase()}.png" alt="${player.country}" class="spotlight-v2__flag"> ${player.country}</div>`
      : '';

    return `
      <a href="/players/${player.slug}/" class="spotlight-v2-redesigned ${rankClass}">
        <div class="spotlight-v2__row-1">
          <div class="spotlight-v2__rank-badge">
            ${rankIcon}
            <span class="spotlight-v2__rank-number">#${player.rank ?? ''}</span>
          </div>
          <div class="spotlight-v2__name">${playerDisplayName}</div>
        </div>
        ${statHTML ? `<div class="spotlight-v2__stat is-climber">${statHTML}</div>` : ''}
        <div class="spotlight-v2__row-3">
          ${characterInfo}
          ${countryInfo}
        </div>
      </a>
    `;
  }

  function syncTop10MiniList(profilesData) {
    const items = document.querySelectorAll('.mini-rank-list .mini-rank-item');
    if (!items.length || !Array.isArray(profilesData)) return;

    items.forEach((item) => {
      const nameLink = item.querySelector('.rank-name');
      const metricsEl = item.querySelector('.mini-rank-metrics');
      if (!nameLink || !metricsEl) return;

      const href = nameLink.getAttribute('href') || '';
      const slugMatch = href.match(/\/players\/([^/]+)\//);
      const itemSlug = slugMatch ? slugMatch[1].toLowerCase() : slug(nameLink.textContent);

      const player = profilesData.find(
        (p) =>
          String(p.slug || '').toLowerCase() === itemSlug ||
          normName(p.name) === normName(nameLink.textContent)
      );
      if (!player || player.rankChange === undefined || player.rankChange === null) return;

      let deltaEl = metricsEl.querySelector('.rank-delta');
      if (!deltaEl) {
        deltaEl = document.createElement('span');
        metricsEl.appendChild(deltaEl);
      }

      const raw = String(player.rankChange).trim();
      const parsed = parseRankChange(raw);

      if (parsed.isNew) {
        deltaEl.className = 'rank-delta delta-new';
        deltaEl.textContent = 'NEW';
      } else if (parsed.signed > 0) {
        deltaEl.className = 'rank-delta delta-up';
        deltaEl.innerHTML = `<i class="fas fa-caret-up"></i> ${Math.abs(parsed.signed)}`;
      } else if (parsed.signed < 0) {
        deltaEl.className = 'rank-delta delta-down';
        deltaEl.innerHTML = `<i class="fas fa-caret-down"></i> ${Math.abs(parsed.signed)}`;
      } else {
        deltaEl.className = 'rank-delta delta-even';
        deltaEl.textContent = '—';
      }
    });
  }

  function renderHomeSpotlight(profilesData) {
    if (!Array.isArray(profilesData) || !profilesData.length) return;

    const topCandidates = profilesData
      .map((p) => ({
        ...p,
        rank: toNum(p.rank),
        slug: p.slug || slug(p.name),
        rankChange6m: extract6MValue(p)
      }))
      .filter((p) => p.rank !== null && p.rank >= 1 && p.rank <= 40)
      .sort((a, b) => a.rank - b.rank);

    if (!topCandidates.length) return;

    const has6M = topCandidates.some(
      (p) => p.rankChange6m !== null && p.rankChange6m !== undefined && p.rankChange6m !== '—'
    );

    const annotated = topCandidates.map((p) => {
      const parsed = parseRankChange(has6M ? p.rankChange6m : p.rankChange);
      return { player: p, ...parsed, abs: Math.abs(parsed.signed) };
    });

    const movers = annotated
      .filter((x) => x.signed > 0 && !x.isNew)
      .sort((a, b) => b.signed - a.signed || a.player.rank - b.player.rank);

    let card = '';
    if (movers.length) {
      const best = movers[0];
      const suffix = has6M ? ' (6M)' : ' Ranks';
      const arrowHTML = `<i class="fas fa-arrow-up"></i> +${best.abs.toLocaleString('en-US', { maximumFractionDigits: 1 })}${suffix}`;
      card = createSpotlightCardHTML(best.player, arrowHTML);
    } else {
      card = createSpotlightCardHTML(topCandidates[0], '');
    }

    spotlightTarget.innerHTML = `
      <div class="spotlight-row">
        <div class="spotlight-title-container">
          <h2 class="spotlight-heading">Player Spotlight</h2>
          <div class="spotlight-subheading"><span class="player-rise-pill">Player on the Rise</span></div>
        </div>
        ${card}
      </div>
    `;
    spotlightTarget.hidden = false;
    syncTop10MiniList(profilesData);
  }

  // 1. Check session cache for live CSV
  let cachedCSV = null;
  try {
    const rawCache = sessionStorage.getItem(CACHE_KEY);
    if (rawCache) {
      const parsed = JSON.parse(rawCache);
      if (parsed && Date.now() - parsed.ts < CACHE_TTL) {
        cachedCSV = parsed.csv;
      }
    }
  } catch {
    // ignore storage errors
  }

  // 2. Render IMMEDIATELY (0ms wait) using inline window.playerProfiles
  if (Array.isArray(window.playerProfiles) && window.playerProfiles.length) {
    if (cachedCSV) applyLiveSheet(window.playerProfiles, cachedCSV);
    renderHomeSpotlight(window.playerProfiles);
  }

  // 3. If no cached live sheet yet, fetch Google Sheet in background and update silently
  if (!cachedCSV) {
    const SHEET_CSV_URL =
      `https://docs.google.com/spreadsheets/d/1otrfs8HN3Shq6U2-qrc4GDxTI4ragnqwbTjweecE12Q/gviz/tq?tqx=out:csv&gid=1862929315&range=A:Z&cachebuster=${Math.floor(Date.now() / 60000)}`;

    fetch(SHEET_CSV_URL)
      .then((res) => (res.ok ? res.text() : null))
      .then((freshCSV) => {
        if (!freshCSV) return;
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), csv: freshCSV }));
        } catch {
          // ignore quota errors
        }
        if (Array.isArray(window.playerProfiles) && window.playerProfiles.length) {
          if (applyLiveSheet(window.playerProfiles, freshCSV)) {
            renderHomeSpotlight(window.playerProfiles);
          }
        }
      })
      .catch(() => {});
  }
});