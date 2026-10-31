document.addEventListener('DOMContentLoaded', () => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  const debounce = (fn, delay = 200) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  };

  // Filter toggle for mobile/tablet
  const filterToggleBtn = $('#filter-toggle-btn');
  const filterForm = $('#player-filters-form');
  const closeFilterForm = () => {
    if (!filterToggleBtn || !filterForm) return;
    filterForm.classList.remove('is-open');
    filterToggleBtn.classList.remove('is-open');
    filterToggleBtn.setAttribute('aria-expanded', 'false');
  };

  if (filterToggleBtn && filterForm) {
    filterToggleBtn.addEventListener('click', () => {
      const isOpen = filterForm.classList.toggle('is-open');
      filterToggleBtn.classList.toggle('is-open', isOpen);
      filterToggleBtn.setAttribute('aria-expanded', isOpen);
    });

    const autoCloseSelector = 'select, input[type="checkbox"], input[type="radio"]';
    const isMobileQuery = window.matchMedia('(max-width: 767px)');

    filterForm.addEventListener('change', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.matches(autoCloseSelector) && isMobileQuery.matches) {
        closeFilterForm();
      }
    });

    const searchSubmitBtn = $('#player-search-submit-btn');
    if (searchSubmitBtn) {
      searchSubmitBtn.addEventListener('click', () => {
        closeFilterForm();
      });
    }
  }

  const toNum = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(String(v).trim());
    return Number.isFinite(n) ? n : null;
  };

  const slug = (s) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const normName = (s) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '');

  function normalizeCharacterKey(s) {
    if (!s) return '';
    return String(s)
      .toLowerCase()
      .replace(/\./g, '-')
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function getCharacterHubSlug(charName) {
    const raw = slug(String(charName || '').replace(/\.png|\.jpg/gi, ''));
    if (raw === 'a-k-i') return 'aki';
    return raw;
  }

  window.handleMissingImage = function (imgElement, rank) {
    const container = imgElement?.parentElement;
    if (!container) return;
    container.classList.add('image-container--no-image');
    const sizeClass = (toNum(rank) ?? 0) >= 1000 ? 'rank-badge--4-digits' : '';
    container.innerHTML = `<div class="player-card__rank-badge rank-badge--full-size ${sizeClass}">${rank ?? ''}</div>`;
  };

  function smartTitleCase(name) {
    if (!name) return '';
    const raw = String(name).trim();
    const lc = raw.toLowerCase();
    if (lc === 'a.k.i.' || lc === 'aki' || lc === 'a-k-i') return 'A.K.I.';
    if (lc === 'jp') return 'JP';
    if (lc === 'e. honda' || lc === 'e-honda' || lc === 'ehonda') return 'E. Honda';
    if (lc === 'm. bison' || lc === 'm-bison' || lc === 'mbison') return 'M. Bison';
    if (lc === 'c. viper' || lc === 'c-viper' || lc === 'cviper') return 'C. Viper';
    return raw
      .split(/(\s|-)/)
      .map((part) => {
        if (part === ' ' || part === '-') return part;
        if (/^[a-z]\.$/i.test(part)) return part.toUpperCase();
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      })
      .join('');
  }

  function formatCharacterName(name) {
    return smartTitleCase(name);
  }

  const gridEl = $('#player-card-grid');
  const resultsCountEl = $('#results-count');
  const noResultsEl = $('#no-results-message');
  const spotlightTarget = $('#spotlight-placement-target');
  const renderedSlugs = new Set();
  let suppressAppendHandlers = false;
  const playerIndexBySlug = new Map();
  const DEFAULT_SORT_KEY = 'rank-desc';
  let skipHistoryUpdate = false;

  const rawProfiles = Array.isArray(window.playerProfiles)
    ? window.playerProfiles
    : [];

  rawProfiles.forEach((p, idx) => {
    if (!p || !p.slug) return;
    playerIndexBySlug.set(p.slug, idx);
  });

  function registerExistingCards(container = gridEl) {
    if (!container) return;
    const cards = container.querySelectorAll('.pcard[data-slug]');
    cards.forEach((card) => {
      const slugVal = card.getAttribute('data-slug');
      if (slugVal) renderedSlugs.add(slugVal);
    });
  }
  registerExistingCards();

  function sameCharKey(a, b) {
    if (!a || !b) return false;
    const na = normalizeCharacterKey(a);
    const nb = normalizeCharacterKey(b);
    if (na === nb) return true;
    const sa = na === 'a-k-i' ? 'aki' : na;
    const sb = nb === 'a-k-i' ? 'aki' : nb;
    return sa === sb;
  }

  function matchesFilters(player, filters) {
    const name = String(player.name || '').toLowerCase();
    const countrySlug = slug(player.country || '');
    const key = normalizeCharacterKey(player.characterKey || player.mainCharacter || '');
    const matchQ = !filters.q || name.includes(filters.q);
    const matchCountry = filters.country === 'all' || countrySlug === filters.country;
    const matchChar = filters.character === 'all' || sameCharKey(key, filters.character);
    return matchQ && matchCountry && matchChar;
  }

  function getFilteredPlayers(filters) {
    const profiles = Array.isArray(window.playerProfiles) ? window.playerProfiles : rawProfiles;
    if (!profiles.length) return [];
    return profiles.filter((p) => matchesFilters(p, filters));
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

  function ensureAllPlayers() {
    const allProfiles = Array.isArray(window.playerProfiles)
      ? window.playerProfiles
      : [];
    if (!allProfiles.length) return [];

    const list = allProfiles
      .filter((p) => {
        const r = toNum(p.rank);
        return r !== null && r >= 1 && r <= 40;
      })
      .sort((a, b) => (toNum(a.rank) ?? 9999) - (toNum(b.rank) ?? 9999))
      .slice(0, 40)
      .map((p) => ({
        rank: toNum(p.rank),
        name: p.name,
        englishName: p.englishName || null,
        slug: p.slug || slug(p.name),
        country: p.country || '',
        mainCharacter: p.mainCharacter || '',
        characterKey: p.characterKey || '',
        characterFileName: p.characterFileName || '',
        photoUrl: p.photoUrl || '',
        rankChange: p.rankChange ?? null,
        rankChange6m: extract6MValue(p),
      }));

    window.allPlayers = list;
    return list;
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

    if (!s || s === '—' || s === '-' || s === '0') {
      return out;
    }

    if (s === 'new' || s === '+new' || s === 'new!') {
      out.isNew = true;
      out.signed = 999;
      return out;
    }

    const signedNum = s.match(/^([+-]?)\s*(\d+(?:\.\d+)?)$/);
    if (signedNum) {
      const sign = signedNum[1] === '-' ? -1 : 1;
      const n = parseFloat(signedNum[2]);
      out.signed = sign * n;
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
    if (anyNum) {
      out.signed = parseFloat(anyNum[1]);
    }

    return out;
  }

  function createMoverCardHTML(player, pillLabel, pillIcon, statHTML) {
    const r = toNum(player.rank);
    const rankClass = r >= 6 && r <= 20 ? 'ranked-6-20' : `rank-${r ?? ''}`;

    let rankIcon = '';
    const rankNum = parseInt(player.rank, 10);
    if (rankNum === 1) {
      rankIcon = '<i class="fas fa-trophy trophy-1" aria-label="1st"></i>';
    } else if (rankNum === 2) {
      rankIcon = '<i class="fas fa-trophy trophy-2" aria-label="2nd"></i>';
    } else if (rankNum === 3) {
      rankIcon = '<i class="fas fa-trophy trophy-3" aria-label="3rd"></i>';
    } else if (rankNum === 4) {
      rankIcon = '<i class="fas fa-medal medal-4" aria-label="4th"></i>';
    }

    const playerDisplayName = player.englishName
      ? `${player.name} (${player.englishName})`
      : player.name;

    const characterInfo = player.mainCharacter
      ? `<div class="spotlight-v2__info-item"><i class="fas fa-user-ninja"></i> ${formatCharacterName(player.mainCharacter)}</div>`
      : '';
    const countryInfo = player.country
      ? `<div class="spotlight-v2__info-item"><img src="/images/flags/${String(player.country).toLowerCase()}.png" alt="${player.country}" class="spotlight-v2__flag"> ${player.country}</div>`
      : '';

    return `
      <div class="mover-slot">
        <div class="spotlight-subheading"><span class="player-rise-pill"><i class="${pillIcon}"></i> ${pillLabel}</span></div>
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
      </div>
    `;
  }

  function renderSpotlight() {
    const allProfiles = Array.isArray(window.playerProfiles) ? window.playerProfiles : [];
    if (!spotlightTarget || !allProfiles.length) return false;

    ensureAllPlayers();

    const ranked = allProfiles
      .map((p) => ({
        ...p,
        rank: toNum(p.rank),
        slug: p.slug || slug(p.name),
        rankChange6m: extract6MValue(p)
      }))
      .filter((p) => p.rank !== null && p.rank >= 1)
      .sort((a, b) => a.rank - b.rank);

    const top40 = ranked.filter((p) => p.rank <= 40);
    const top200 = ranked.filter((p) => p.rank <= 200);
    if (!top40.length) {
      spotlightTarget.innerHTML = '';
      return false;
    }

    // 1. 6M Hot Streak (Top 40 biggest 6M rating gain)
    const movers6M = top40
      .map((p) => ({ player: p, ...parseRankChange(p.rankChange6m) }))
      .filter((x) => x.signed > 0 && !x.isNew)
      .sort((a, b) => b.signed - a.signed || a.player.rank - b.player.rank);

    const best6M = movers6M[0];
    const card6M = best6M
      ? createMoverCardHTML(
          best6M.player,
          '6M Hot Streak',
          'fas fa-fire',
          `<i class="fas fa-arrow-up"></i> +${Math.abs(best6M.signed).toLocaleString('en-US', { maximumFractionDigits: 1 })} (6M)`
        )
      : '';

    // 2. Biggest Jump (Top 200 biggest short-term rank jump, excluding 6M winner)
    const moversWeekly = top200
      .filter((p) => !best6M || p.slug !== best6M.player.slug)
      .map((p) => ({ player: p, ...parseRankChange(p.rankChange) }))
      .filter((x) => x.signed > 0 && !x.isNew)
      .sort((a, b) => b.signed - a.signed || a.player.rank - b.player.rank);

    const bestWeekly = moversWeekly[0];
    const cardWeekly = bestWeekly
      ? createMoverCardHTML(
          bestWeekly.player,
          'Biggest Jump (Top 200)',
          'fas fa-bolt',
          `<i class="fas fa-arrow-up"></i> +${Math.round(Math.abs(bestWeekly.signed))} Ranks`
        )
      : '';

    spotlightTarget.innerHTML = `
      <div class="spotlight-row">
        <div class="spotlight-title-container">
          <h2 class="spotlight-heading">Player Spotlight</h2>
        </div>
        <div class="movers-strip">
          ${card6M}
          ${cardWeekly}
        </div>
      </div>
    `;
    spotlightTarget.hidden = false;
    return Boolean(best6M);
  }

  // Unified Snapshot Bar for Country, Character, or Both Country + Character
  function renderFilterSnapshot(filters) {
    if (!gridEl) return;
    let barEl = $('#regional-power-bar');

    const countrySlug = filters?.country || 'all';
    const charKey = filters?.character || 'all';
    const hasCountry = countrySlug !== 'all';
    const hasChar = charKey !== 'all';

    if (!hasCountry && !hasChar) {
      if (barEl) barEl.hidden = true;
      return;
    }

    const allProfiles = Array.isArray(window.playerProfiles) ? window.playerProfiles : [];
    if (!allProfiles.length) {
      if (barEl) barEl.hidden = true;
      return;
    }

    const matchingPlayers = allProfiles
      .filter((p) => {
        const r = toNum(p.rank);
        if (r === null) return false;
        const pCountry = slug(p.country || '');
        const pChar = normalizeCharacterKey(p.characterKey || p.mainCharacter || '');
        if (hasCountry && pCountry !== countrySlug) return false;
        if (hasChar && !sameCharKey(pChar, charKey)) return false;
        return true;
      })
      .sort((a, b) => toNum(a.rank) - toNum(b.rank));

    if (!matchingPlayers.length) {
      if (barEl) barEl.hidden = true;
      return;
    }

    if (!barEl) {
      barEl = document.createElement('div');
      barEl.id = 'regional-power-bar';
      barEl.className = 'regional-power-bar';
      gridEl.parentElement.insertBefore(barEl, gridEl);
    }

    const leader = matchingPlayers[0];
    const leaderName = leader.englishName ? `${leader.name} (${leader.englishName})` : leader.name;
    const top200Count = matchingPlayers.filter((p) => toNum(p.rank) <= 200).length;

    const clearBtnHTML = `
      <button type="button" class="regional-badge regional-badge--clear" data-clear-snapshot title="Clear active filters" aria-label="Clear active filters">
        <i class="fas fa-times"></i>
        <span class="regional-badge__label">Clear</span>
      </button>
    `;

    // CASE 1: Both Country AND Character Selected
    if (hasCountry && hasChar) {
      const countryCode = String(leader.country || countrySlug).toUpperCase();
      const charDisplay = formatCharacterName(leader.mainCharacter || charKey);
      const charHubSlug = getCharacterHubSlug(leader.mainCharacter || charKey);

      barEl.innerHTML = `
        <div class="regional-badge regional-badge--country">
          <img src="/images/flags/${countryCode.toLowerCase()}.png" alt="${countryCode}" class="regional-badge__flag">
          <span class="regional-badge__label">${countryCode} &bull; ${charDisplay}</span>
        </div>

        <a href="/players/${leader.slug}/" class="regional-badge regional-badge--gold" title="View #1 ${countryCode} ${charDisplay} Player">
          <i class="fas fa-trophy"></i>
          <span class="regional-badge__label">#1 ${countryCode} ${charDisplay}:</span>
          <span class="regional-badge__value">${leaderName} <em>(#${leader.rank})</em></span>
        </a>

        <div class="regional-badge">
          <i class="fas fa-users"></i>
          <span class="regional-badge__label">Top 200:</span>
          <span class="regional-badge__value">${top200Count} ${top200Count === 1 ? 'Player' : 'Players'}</span>
        </div>

        <a href="/characters/${charHubSlug}/" class="regional-badge regional-badge--blue" title="View ${charDisplay} Character Page">
          <i class="fas fa-user-ninja"></i>
          <span class="regional-badge__value">${charDisplay} Stats &rarr;</span>
        </a>

        ${clearBtnHTML}
      `;
    }
    // CASE 2: Country Only Selected
    else if (hasCountry) {
      const countryCode = String(leader.country || countrySlug).toUpperCase();

      const charCounts = new Map();
      matchingPlayers.forEach((p) => {
        if (!p.mainCharacter || p.mainCharacter === 'N/A') return;
        const c = formatCharacterName(p.mainCharacter);
        const hubSlug = getCharacterHubSlug(p.mainCharacter);
        const prev = charCounts.get(c) || { count: 0, hubSlug };
        charCounts.set(c, { count: prev.count + 1, hubSlug });
      });
      const topCharEntry = [...charCounts.entries()].sort((a, b) => b[1].count - a[1].count)[0];

      barEl.innerHTML = `
        <div class="regional-badge regional-badge--country">
          <img src="/images/flags/${countryCode.toLowerCase()}.png" alt="${countryCode}" class="regional-badge__flag">
          <span class="regional-badge__label">${countryCode} Snapshot</span>
        </div>

        <a href="/players/${leader.slug}/" class="regional-badge regional-badge--gold" title="View #1 ${countryCode} Player">
          <i class="fas fa-trophy"></i>
          <span class="regional-badge__label">#1 ${countryCode}:</span>
          <span class="regional-badge__value">${leaderName} <em>(#${leader.rank})</em></span>
        </a>

        <div class="regional-badge">
          <i class="fas fa-users"></i>
          <span class="regional-badge__label">Top 200:</span>
          <span class="regional-badge__value">${top200Count} ${top200Count === 1 ? 'Player' : 'Players'}</span>
        </div>

        ${topCharEntry ? `
        <a href="/characters/${topCharEntry[1].hubSlug}/" class="regional-badge regional-badge--blue" title="View ${topCharEntry[0]} Character Page">
          <i class="fas fa-user-ninja"></i>
          <span class="regional-badge__label">Top Main:</span>
          <span class="regional-badge__value">${topCharEntry[0]} (${topCharEntry[1].count})</span>
        </a>` : ''}

        ${clearBtnHTML}
      `;
    }
    // CASE 3: Character Only Selected
    else if (hasChar) {
      const charDisplay = formatCharacterName(leader.mainCharacter || charKey);
      const charHubSlug = getCharacterHubSlug(leader.mainCharacter || charKey);

      const countryCounts = new Map();
      matchingPlayers.forEach((p) => {
        if (!p.country || p.country === 'N/A') return;
        const cCode = String(p.country).toUpperCase();
        countryCounts.set(cCode, (countryCounts.get(cCode) || 0) + 1);
      });
      const topCountry = [...countryCounts.entries()].sort((a, b) => b[1] - a[1])[0];

      barEl.innerHTML = `
        <div class="regional-badge regional-badge--country">
          <i class="fas fa-user-ninja"></i>
          <span class="regional-badge__label">${charDisplay} Snapshot</span>
        </div>

        <a href="/players/${leader.slug}/" class="regional-badge regional-badge--gold" title="View #1 ${charDisplay} Player">
          <i class="fas fa-crown"></i>
          <span class="regional-badge__label">#1 ${charDisplay}:</span>
          <span class="regional-badge__value">${leaderName} <em>(#${leader.rank})</em></span>
        </a>

        <div class="regional-badge">
          <i class="fas fa-users"></i>
          <span class="regional-badge__label">Top 200:</span>
          <span class="regional-badge__value">${top200Count} ${top200Count === 1 ? 'Player' : 'Players'}</span>
        </div>

        ${topCountry ? `
        <button type="button" class="regional-badge regional-badge--interactive" data-filter-country="${slug(topCountry[0])}" title="Filter ${charDisplay} players in ${topCountry[0]}">
          <img src="/images/flags/${topCountry[0].toLowerCase()}.png" alt="${topCountry[0]}" class="regional-badge__flag">
          <span class="regional-badge__label">Most Popular In:</span>
          <span class="regional-badge__value">${topCountry[0]} (${topCountry[1]})</span>
        </button>` : ''}

        <a href="/characters/${charHubSlug}/" class="regional-badge regional-badge--blue" title="View ${charDisplay} Character Page">
          <i class="fas fa-chart-line"></i>
          <span class="regional-badge__value">${charDisplay} Stats &rarr;</span>
        </a>

        ${clearBtnHTML}
      `;
    }

    const countryBtn = barEl.querySelector('[data-filter-country]');
    if (countryBtn) {
      countryBtn.addEventListener('click', () => {
        const countrySel = $('#filter-country');
        const targetCountry = countryBtn.getAttribute('data-filter-country');
        if (countrySel && targetCountry) {
          countrySel.value = targetCountry;
          queueSortAndFilter();
        }
      });
    }

    const clearBtn = barEl.querySelector('[data-clear-snapshot]');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        const searchInput = $('#player-search-input');
        const countrySel = $('#filter-country');
        const charSel = $('#filter-character');
        if (searchInput) searchInput.value = '';
        if (countrySel) countrySel.value = 'all';
        if (charSel) charSel.value = 'all';
        queueSortAndFilter();
      });
    }

    barEl.hidden = false;
  }

  const getItems = () => (gridEl ? Array.from(gridEl.children) : []);

  const nameFromNode = (el) =>
    el.getAttribute('data-name') ||
    el.querySelector('.player-card__name, .archive-item-card__name')?.textContent?.trim() ||
    '';

  const sortNameFromNode = (el) => {
    const english = el.getAttribute('data-english-name');
    if (english && english.trim()) return english.trim();
    return nameFromNode(el);
  };

  const rankFromNode = (el) => {
    const asData = toNum(el.getAttribute('data-rank'));
    if (asData !== null) return asData;
    const txt = (
      el.querySelector('.player-card__rank-badge, .rank-badge')?.textContent || ''
    ).replace(/\D/g, '');
    return toNum(txt) ?? 9999;
  };

  const countrySlugFromNode = (el) => el.getAttribute('data-country') || '';
  const characterKeyFromNode = (el) => {
    const fromAttr = el.getAttribute('data-character');
    if (fromAttr && fromAttr.trim()) return normalizeCharacterKey(fromAttr);
    const disp = el.getAttribute('data-character-display') || '';
    return normalizeCharacterKey(disp);
  };

  const currentSortKey = () => $('#sort-by')?.value || 'rank-asc';

  let sortFilterQueue = Promise.resolve();

  function expectedMatchCount(filters) {
    return getFilteredPlayers(filters).length;
  }

  function collectCurrentFilters() {
    const searchInput = $('#player-search-input');
    const countrySelect = $('#filter-country');
    const characterSelect = $('#filter-character');
    const q = (searchInput?.value || '').trim().toLowerCase();
    const country = countrySelect?.value || 'all';
    const characterValue = characterSelect?.value || 'all';
    const character = normalizeCharacterKey(characterValue);
    const hasActiveFilters =
      Boolean(q) || country !== 'all' || character !== 'all';
    return { q, country, character, hasActiveFilters };
  }

  function updateHistoryFromControls() {
    if (skipHistoryUpdate) {
      skipHistoryUpdate = false;
      return;
    }

    const searchInput = $('#player-search-input');
    const countrySelect = $('#filter-country');
    const characterSelect = $('#filter-character');
    const sortSelect = $('#sort-by');

    const params = new URLSearchParams();
    const qRaw = (searchInput?.value || '').trim();
    if (qRaw) params.set('q', qRaw);

    const countryVal = countrySelect?.value || 'all';
    if (countryVal && countryVal !== 'all') params.set('country', countryVal);

    const characterVal = characterSelect?.value || 'all';
    if (characterVal && characterVal !== 'all') params.set('character', characterVal);

    const sortVal = sortSelect?.value || DEFAULT_SORT_KEY;
    if (sortVal !== DEFAULT_SORT_KEY) params.set('sort', sortVal);

    const newQuery = params.toString();
    const newUrl = `${window.location.pathname}${newQuery ? `?${newQuery}` : ''}`;
    const state = {
      q: qRaw,
      country: countryVal,
      character: characterVal,
      sort: sortVal,
    };
    window.history.replaceState(state, '', newUrl);
  }

  async function applyFilters(triggerAutoload = true, providedFilters = null) {
    const filters = providedFilters || collectCurrentFilters();
    const { q, country, character, hasActiveFilters } = filters;

    const rows = getItems();
    let matchCount = 0;
    let visible = 0;

    rows.forEach((el) => {
      const name = nameFromNode(el).toLowerCase();
      const elCountry = countrySlugFromNode(el);
      const elChar = characterKeyFromNode(el);

      const matchQ = !q || name.includes(q);
      const matchCountry = country === 'all' || elCountry === country;
      const matchChar = character === 'all' || sameCharKey(elChar, character);

      const isMatch = matchQ && matchCountry && matchChar;
      if (isMatch) {
        matchCount++;
        el.style.display = '';
        visible++;
      } else {
        el.style.display = 'none';
      }
    });

    let totalMatches = expectedMatchCount(filters);
    if (!Number.isFinite(totalMatches) || totalMatches === 0) {
      totalMatches = matchCount;
    }

    if (resultsCountEl) {
      if (visible === 0) {
        resultsCountEl.textContent = 'No players';
      } else {
        const contextParts = [];
        if (country !== 'all') contextParts.push(country.toUpperCase());
        if (character !== 'all') {
          const charSel = $('#filter-character');
          const selectedText = charSel?.options[charSel.selectedIndex]?.text;
          contextParts.push(
            selectedText && selectedText !== 'All Characters'
              ? selectedText
              : formatCharacterName(character)
          );
        }
        const contextStr = contextParts.length ? ` ${contextParts.join(' • ')}` : '';
        const noun = visible === 1 ? 'player' : 'players';
        const label = `${visible}${contextStr} ${noun}`;
        const extra =
          hasActiveFilters && totalMatches > visible
            ? ` (showing ${visible} of ${totalMatches})`
            : '';
        resultsCountEl.textContent = label + extra;
      }
    }
    if (noResultsEl) {
      noResultsEl.style.display = visible === 0 ? 'block' : 'none';
    }

    renderFilterSnapshot(filters);
    return { visible, totalMatches, filters };
  }

  async function sortGrid() {
    if (!gridEl) return;
    const key = currentSortKey();
    const rows = getItems();
    if (!rows.length) return;

    const cmp =
      {
        'rank-asc': (a, b) => rankFromNode(b) - rankFromNode(a),
        'rank-desc': (a, b) => rankFromNode(a) - rankFromNode(b),
        'name-asc': (a, b) => sortNameFromNode(a).localeCompare(sortNameFromNode(b)),
        'name-desc': (a, b) => sortNameFromNode(b).localeCompare(sortNameFromNode(a)),
      }[key] || ((a, b) => rankFromNode(a) - rankFromNode(b));

    const fragment = document.createDocumentFragment();
    rows.sort(cmp).forEach((el) => fragment.appendChild(el));
    gridEl.appendChild(fragment);
  }

  function populateFilterOptions() {
    const countrySel = $('#filter-country');
    const charSel = $('#filter-character');
    const profiles = Array.isArray(window.playerProfiles)
      ? window.playerProfiles
      : [];

    const countries = new Map();
    const characters = new Map();

    profiles.forEach((p) => {
      if (p.country && p.country !== 'N/A') {
        const cKey = slug(p.country);
        const cLabel = String(p.country).toUpperCase();
        countries.set(cKey, cLabel);
      }
      if (p.mainCharacter && p.mainCharacter !== 'N/A') {
        const k = normalizeCharacterKey(p.characterKey || p.mainCharacter);
        const label = formatCharacterName(p.mainCharacter);
        characters.set(k, label);
      }
    });
    const rows = getItems();
    rows.forEach((el) => {
      const ctryKey = (el.getAttribute('data-country') || '').trim();
      if (ctryKey && !countries.has(ctryKey)) {
        const ctryLabel = (
          el.getAttribute('data-country-display') || ctryKey
        ).toUpperCase();
        countries.set(ctryKey, ctryLabel);
      }
      const disp = el.getAttribute('data-character-display') || '';
      const key = characterKeyFromNode(el);
      if (key && !characters.has(key)) {
        const label = formatCharacterName(disp || key);
        characters.set(key, label);
      }
    });
    const currentCountry = countrySel?.value || 'all';
    const currentCharNorm = normalizeCharacterKey(charSel?.value || 'all');
    if (countrySel) {
      countrySel.innerHTML =
        `<option value="all">All Countries</option>` +
        [...countries.entries()]
          .sort((a, b) => a[1].localeCompare(b[1]))
          .map(([val, label]) => `<option value="${val}">${label}</option>`)
          .join('');
      if (currentCountry !== 'all' && countries.has(currentCountry)) {
        countrySel.value = currentCountry;
      }
    }
    if (charSel) {
      const entries = [...characters.entries()].sort((a, b) =>
        a[1].localeCompare(b[1])
      );
      charSel.innerHTML =
        `<option value="all">All Characters</option>` +
        entries
          .map(([val, label]) => `<option value="${val}">${label}</option>`)
          .join('');
      const matchKey = entries
        .map((e) => e[0])
        .find((k) => sameCharKey(k, currentCharNorm));
      if (matchKey) charSel.value = matchKey;
    }
  }

  function pruneSortOptions() {
    const sortSel = document.querySelector('#sort-by');
    if (!sortSel) return;

    const removeVals = new Set([
      'country-asc',
      'country-desc',
      'character-asc',
      'character-desc',
    ]);

    const current = sortSel.value;
    [...sortSel.options].forEach((opt) => {
      if (removeVals.has(opt.value)) opt.remove();
    });
    if (removeVals.has(current)) sortSel.value = DEFAULT_SORT_KEY;
  }

  function queueSortAndFilter(options = {}) {
    const triggerAutoload =
      options.triggerAutoload === undefined ? true : options.triggerAutoload;
    sortFilterQueue = sortFilterQueue
      .then(async () => {
        const filters = collectCurrentFilters();
        await sortGrid();
        await applyFilters(triggerAutoload, filters);
      })
      .then(() => {
        updateHistoryFromControls();
      })
      .catch(() => {});
    return sortFilterQueue;
  }

  function bindUI() {
    const searchInput = $('#player-search-input');
    const searchClearBtn = $('#player-search-clear-btn');
    const countrySelect = $('#filter-country');
    const characterSelect = $('#filter-character');
    const sortSelect = $('#sort-by');
    const resetBtn = $('#reset-filters-btn');
    const noResultsResetBtn = $('#no-results-reset-btn');
    pruneSortOptions();

    const onSearch = debounce(() => queueSortAndFilter(), 200);
    searchInput?.addEventListener('input', onSearch);

    searchClearBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      queueSortAndFilter();
    });

    countrySelect?.addEventListener('change', () => queueSortAndFilter());
    characterSelect?.addEventListener('change', () => queueSortAndFilter());
    sortSelect?.addEventListener('change', () => {
      queueSortAndFilter();
    });

    const doReset = (e) => {
      e?.preventDefault?.();
      if (searchInput) searchInput.value = '';
      if (countrySelect) countrySelect.value = 'all';
      if (characterSelect) characterSelect.value = 'all';
      if (sortSelect) sortSelect.value = DEFAULT_SORT_KEY;
      queueSortAndFilter();
    };

    resetBtn?.addEventListener('click', doReset);
    noResultsResetBtn?.addEventListener('click', doReset);

    document.addEventListener('archive:items-appended', () => {
      populateFilterOptions();
      if (suppressAppendHandlers) return;
      queueSortAndFilter({ triggerAutoload: false });
    });
  }

  function loadFiltersFromURL(params = new URLSearchParams(window.location.search)) {
    const searchInput = $('#player-search-input');
    const countrySelect = $('#filter-country');
    const characterSelect = $('#filter-character');
    const sortSelect = $('#sort-by');

    const searchParam = params.get('q');
    if (searchInput) {
      searchInput.value = searchParam || '';
    }

    if (sortSelect) {
      const availableSorts = Array.from(sortSelect.options).map((opt) => opt.value);
      const sortParam = params.get('sort');
      if (sortParam && availableSorts.includes(sortParam)) {
        sortSelect.value = sortParam;
      } else {
        sortSelect.value = DEFAULT_SORT_KEY;
      }
    }

    if (countrySelect) {
      const countryParam = params.get('country');
      if (countryParam) {
        const normalizedCountry = slug(countryParam);
        const options = Array.from(countrySelect.options);
        const match = options.find((opt) => opt.value === normalizedCountry);
        countrySelect.value = match ? normalizedCountry : 'all';
      } else {
        countrySelect.value = 'all';
      }
    }

    if (characterSelect) {
      const characterParam = params.get('character');
      if (characterParam) {
        const normalizedChar = normalizeCharacterKey(characterParam);
        const options = Array.from(characterSelect.options);
        const match = options.find((opt) => sameCharKey(opt.value, normalizedChar));
        characterSelect.value = match ? match.value : 'all';
      } else {
        characterSelect.value = 'all';
      }
    }
  }

  const initialParams = new URLSearchParams(window.location.search);

  // --- Fast Spotlight & Live Sheet Sync (Stale-While-Revalidate) ---
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

  function applyLiveSheetToProfiles(profilesData, csvText) {
    if (!csvText || !Array.isArray(profilesData)) return false;
    const liveSheetMap = parseLiveSheetCSV(csvText);
    if (!liveSheetMap.size) return false;

    profilesData.forEach((p) => {
      const live =
        liveSheetMap.get(normName(p.name)) ||
        liveSheetMap.get(normName(p.englishName)) ||
        liveSheetMap.get(String(p.slug || '').toLowerCase());

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

  if (spotlightTarget) {
    const CACHE_KEY = 'fgc_live_sheet_csv_v1';
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes session cache for instant navigation
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

    // Step 1: If window.playerProfiles is already preloaded, render immediately (0ms wait)
    if (Array.isArray(window.playerProfiles) && window.playerProfiles.length) {
      if (cachedCSV) applyLiveSheetToProfiles(window.playerProfiles, cachedCSV);
      renderSpotlight();
      renderFilterSnapshot(collectCurrentFilters());
    }

    // Step 2: Fetch local /api/player-profiles.json (~30ms) and render right away without waiting on Google Sheets
    const profilesPromise = fetch('/api/player-profiles.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((profilesData) => {
        if (Array.isArray(profilesData) && profilesData.length) {
          if (cachedCSV) applyLiveSheetToProfiles(profilesData, cachedCSV);
          window.playerProfiles = profilesData;
          populateFilterOptions();
          loadFiltersFromURL(initialParams);
          renderSpotlight();
          applyFilters(false);
        }
        return profilesData;
      })
      .catch(() => null);

    // Step 3: Fetch live Google Sheet CSV in the background and refresh Spotlight silently
    if (!cachedCSV) {
      const SHEET_CSV_URL =
        `https://docs.google.com/spreadsheets/d/1otrfs8HN3Shq6U2-qrc4GDxTI4ragnqwbTjweecE12Q/gviz/tq?tqx=out:csv&gid=1862929315&range=A:Z&cachebuster=${Math.floor(Date.now() / 60000)}`;

      Promise.all([
        profilesPromise,
        fetch(SHEET_CSV_URL).then((res) => (res.ok ? res.text() : null)).catch(() => null)
      ]).then(([profilesData, freshCSV]) => {
        const targetProfiles = profilesData || window.playerProfiles;
        if (freshCSV && Array.isArray(targetProfiles) && targetProfiles.length) {
          try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), csv: freshCSV }));
          } catch {
            // ignore quota errors
          }
          if (applyLiveSheetToProfiles(targetProfiles, freshCSV)) {
            window.playerProfiles = targetProfiles;
            renderSpotlight();
            renderFilterSnapshot(collectCurrentFilters());
          }
        }
      });
    }
  }

  populateFilterOptions();
  loadFiltersFromURL(initialParams);
  bindUI();
  window.addEventListener('popstate', () => {
    const params = new URLSearchParams(window.location.search);
    skipHistoryUpdate = true;
    loadFiltersFromURL(params);
    queueSortAndFilter();
  });

  // Prevent the initial pre-fetch pass from overwriting ?country=... or ?character=... in the URL
  if (!Array.isArray(window.playerProfiles) || !window.playerProfiles.length) {
    skipHistoryUpdate = true;
  }
  queueSortAndFilter();
});