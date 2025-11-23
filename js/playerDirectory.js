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
      // Only auto-close on mobile (phones only, not tablets)
      if (target.matches(autoCloseSelector) && isMobileQuery.matches) {
        closeFilterForm();
      }
    });

    // Close filter form when search submit button (magnifying glass) is clicked
    const searchSubmitBtn = $('#player-search-submit-btn');
    if (searchSubmitBtn) {
      searchSubmitBtn.addEventListener('click', () => {
        closeFilterForm();
      });
    }
  }

  const toNum = (v) => {
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
  function normalizeCharacterKey(s) {
    if (!s) return '';
    return String(s)
      .toLowerCase()
      .replace(/\./g, '-')          
      .replace(/[^a-z0-9-]+/g, '-') 
      .replace(/-+/g, '-')          
      .replace(/^-+|-+$/g, '');     
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
    if (lc === 'a.k.i.' || lc === 'aki') return 'A.K.I.';
    if (lc === 'jp') return 'JP';
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
  const PAGE_SIZE = 48;
  const renderedSlugs = new Set();
  const fetchedPages = new Set([0]);
  let suppressAppendHandlers = false;
  const playerIndexBySlug = new Map();
  const DEFAULT_SORT_KEY = 'rank-desc';
  let skipHistoryUpdate = false;
  let isInitialLoad = true;
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
      const slug = card.getAttribute('data-slug');
      if (slug) renderedSlugs.add(slug);
    });
  }
  registerExistingCards();
  const paginationUrlBuilder = (() => {
    const nextA = document.querySelector('[data-next-page-link][rel="next"]');
    if (nextA) {
      try {
        const url = new URL(nextA.getAttribute('href') || '', window.location.origin);
        const match = url.pathname.match(/^(.*\/page\/)(\d+)(\/?)$/);
        if (match) {
          const prefix = match[1];
          const suffix = match[3] || '/';
          const base = window.location.pathname;
          return (index) => {
            if (index === 0) return base;
            return `${prefix}${index + 1}${suffix}`;
          };
        }
      } catch (err) {
        console.warn('Unable to derive pagination pattern from next link', err);
      }
    }
    const current = window.location.pathname;
    const match = current.match(/^(.*\/page\/)(\d+)(\/?)$/);
    if (match) {
      const prefix = match[1];
      const suffix = match[3] || '/';
      return (index) => `${prefix}${index + 1}${suffix}`;
    }
    const base = current.endsWith('/') ? current : `${current}/`;
    return (index) => (index === 0 ? base : `${base}page/${index + 1}/`);
  })();

  function pageIndexFromUrl(url) {
    if (!url) return null;
    try {
      const parsed = new URL(url, window.location.origin);
      const match = parsed.pathname.match(/\/page\/(\d+)\/?$/);
      if (match) {
        const pageNumber = parseInt(match[1], 10);
        if (Number.isFinite(pageNumber) && pageNumber > 0) {
          return pageNumber - 1;
        }
      } else if (parsed.pathname === window.location.pathname) {
        return 0;
      }
    } catch {
      // fall through
    }
    return null;
  }

  function getCardSlug(node) {
    return node?.getAttribute?.('data-slug') || null;
  }

  function appendCardsFromDoc(doc) {
    if (!doc || !gridEl) return false;
    const newGrid = doc.querySelector('#player-card-grid');
    if (!newGrid) return false;
    const cards = Array.from(newGrid.children);
    let appended = false;
    cards.forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      const slug = getCardSlug(node);
      if (!slug) return;

      // Double-check: ensure not already in Set AND not already in DOM
      if (renderedSlugs.has(slug)) return;
      const existingCard = gridEl.querySelector(`[data-slug="${slug}"]`);
      if (existingCard) return;

      renderedSlugs.add(slug);
      gridEl.appendChild(node);
      appended = true;
    });
    return appended;
  }

  async function fetchPageByIndex(pageIndex) {
    if (pageIndex <= 0) return false;
    if (fetchedPages.has(pageIndex)) return true;
    if (typeof paginationUrlBuilder !== 'function') return false;

    const path = paginationUrlBuilder(pageIndex);
    if (!path) return false;
    let url;
    try {
      url = new URL(path, window.location.origin).toString();
    } catch {
      url = path;
    }
    try {
      const res = await fetch(url, { credentials: 'same-origin' });
      if (!res.ok) return false;
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const appended = appendCardsFromDoc(doc);
      fetchedPages.add(pageIndex);
      if (appended) {
        document.dispatchEvent(new CustomEvent('archive:items-appended'));
      }
      return appended;
    } catch (err) {
      console.error('Failed to fetch page', pageIndex + 1, err);
      return false;
    }
  }

  function sortRequiresSupplementalData() {
    return false;
  }

  function getDataSortComparator(key) {
    const toRank = (p) => {
      const r = toNum(p.rank);
      return r === null ? 9999 : r;
    };
    const byName = (p) => String(p.name || '');
    return (
      {
        'rank-asc': (a, b) => toRank(b) - toRank(a),
        'rank-desc': (a, b) => toRank(a) - toRank(b),
        'name-asc': (a, b) => byName(a).localeCompare(byName(b)),
        'name-desc': (a, b) => byName(b).localeCompare(byName(a)),
      }[key] ||
      ((a, b) => toRank(a) - toRank(b))
    );
  }

  function matchesFilters(player, filters) {
    const name = String(player.name || '').toLowerCase();
    const countrySlug = slug(player.country || '');
    const key = normalizeCharacterKey(player.characterKey || player.mainCharacter || '');
    const matchQ = !filters.q || name.includes(filters.q);
    const matchCountry = filters.country === 'all' || countrySlug === filters.country;
    const matchChar = filters.character === 'all' || key === filters.character;
    return matchQ && matchCountry && matchChar;
  }

  function getFilteredPlayers(filters) {
    if (!rawProfiles.length) return [];
    return rawProfiles.filter((p) => matchesFilters(p, filters));
  }

  async function ensurePagesForSort() {
    return;
  }
  function ensureAllPlayers() {
    // Cache the result to avoid re-processing on every call
    if (window.allPlayers) return window.allPlayers;

    const allProfiles = Array.isArray(window.playerProfiles)
      ? window.playerProfiles
      : [];
    if (!allProfiles.length) return [];

    // Assume playerProfiles is already sorted by rank from server
    // Just filter for valid ranks and take top 40
    const list = allProfiles
      .filter((p) => {
        const r = toNum(p.rank);
        return r !== null && r > 0;
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
        rankChange: p.rankChange ?? null
      }));

    window.allPlayers = list;
    return list;
  }
  function createSpotlightCardHTML(player, statHTML) {
    const r = toNum(player.rank);
    const rankClass = r >= 6 && r <= 20 ? 'ranked-6-20' : `rank-${r ?? ''}`;

    // Trophy/medal icons for top 4
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

    // Format player name with English name in parentheses if available
    const playerDisplayName = player.englishName
      ? `${player.name} (${player.englishName})`
      : player.name;

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
  function parseRankChange(change) {
    const out = { signed: 0, isNew: false };

    if (change == null) return out;

    if (typeof change === 'number') {
      out.signed = Number.isFinite(change) ? change : 0;
      return out;
    }

    const s = String(change).trim().toLowerCase();

    if (!s || s === '—' || s === '–' || s === '-' || s === '0') {
      return out;
    }

    if (s === 'new' || s === '+new' || s === 'new!') {
      out.isNew = true;
      out.signed = 999;
      return out;
    }
    const signedNum = s.match(/^([+-]?)\s*(\d+)$/);
    if (signedNum) {
      const sign = signedNum[1] === '-' ? -1 : 1;
      const n = parseInt(signedNum[2], 10);
      out.signed = sign * n;
      return out;
    }
    const upPhrase = s.match(/(?:up|rise|gained|gain|climb|climbed)\s+(\d+)/);
    if (upPhrase) {
      out.signed = parseInt(upPhrase[1], 10);
      return out;
    }
    const downPhrase = s.match(/(?:down|fell|fall|drop|dropped|declined)\s+(\d+)/);
    if (downPhrase) {
      out.signed = -parseInt(downPhrase[1], 10);
      return out;
    }
    const anyNum = s.match(/(\d+)/);
    if (anyNum) {
      out.signed = parseInt(anyNum[1], 10);
    }

    return out;
  }

  function renderSpotlight() {
    const players = ensureAllPlayers();
    if (!spotlightTarget || !players.length) return;
    const topCandidates = players
      .filter((p) => {
        const r = toNum(p.rank);
        return r !== null && r > 0 && r <= 40;
      })
      .sort((a, b) => (toNum(a.rank) ?? 9999) - (toNum(b.rank) ?? 9999));

    if (!topCandidates.length) {
      spotlightTarget.innerHTML = '';
      return;
    }
    const annotated = topCandidates.map((p) => {
      const parsed = parseRankChange(p.rankChange);
      return { player: p, ...parsed, abs: Math.abs(parsed.signed) };
    });
    const news = annotated.filter((x) => x.isNew);
    if (news.length) {
      const bestNew = news.sort(
        (a, b) => (toNum(a.player.rank) ?? 9999) - (toNum(b.player.rank) ?? 9999)
      )[0];
      const card = createSpotlightCardHTML(bestNew.player, `<i class="fas fa-star"></i> New to Top 40!`);
      spotlightTarget.innerHTML = `
        <div class="spotlight-row">
          <div class="spotlight-title-container">
            <h2 class="spotlight-heading">Player Spotlight</h2>
            <div class="spotlight-subheading"><span class="player-rise-pill">Player on the Rise</span></div>
          </div>
          ${card}
        </div>
      `;
      return;
    }
    const movers = annotated.filter((x) => x.signed > 0);
    if (movers.length) {
      movers.sort((a, b) => {
        if (b.abs !== a.abs) return b.abs - a.abs;
        return (toNum(a.player.rank) ?? 9999) - (toNum(b.player.rank) ?? 9999);
      });
      const best = movers[0];
      const arrowHTML =
        best.signed > 0
          ? `<i class="fas fa-arrow-up"></i> ${best.abs} Ranks`
          : `<i class="fas fa-arrow-down"></i> ${best.abs} Ranks`;
      const card = createSpotlightCardHTML(best.player, arrowHTML);
      spotlightTarget.innerHTML = `
        <div class="spotlight-row">
          <div class="spotlight-title-container">
            <h2 class="spotlight-heading">Player Spotlight</h2>
            <div class="spotlight-subheading"><span class="player-rise-pill">Please on the Rise</span></div>
          </div>
          ${card}
        </div>
      `;
      return;
    }
    const top1 = topCandidates[0];
    const card = createSpotlightCardHTML(top1, '');
    spotlightTarget.innerHTML = `
      <div class="spotlight-row">
        <div class="spotlight-title-container">
          <h2 class="spotlight-heading">Player Spotlight</h2>
          <div class="spotlight-subheading"><span class="player-rise-pill">Top Ranked</span></div>
        </div>
        ${card}
      </div>
    `;
  }
  const getItems = () => (gridEl ? Array.from(gridEl.children) : []);
  const countVisibleItems = () => {
    let count = 0;
    getItems().forEach((el) => {
      if (el.style.display !== 'none') count++;
    });
    return count;
  };

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

  const MAX_AUTOLOAD_PAGES = 24;
  let sortFilterQueue = Promise.resolve();

  function expectedMatchCount(filters) {
    return getFilteredPlayers(filters).length;
  }

  async function ensureAllMatchesLoaded(filters, summary = null) {
    // All cards are loaded on page load - no need to fetch additional pages
    return;
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
      const matchChar = character === 'all' || elChar === character;

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
    if (!Number.isFinite(totalMatches)) {
      totalMatches = matchCount;
    }

    if (resultsCountEl) {
      if (visible === 0) {
        resultsCountEl.textContent = 'No players';
      } else {
        const label = `${visible} players`;
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

    const summary = { visible, totalMatches, filters };

    if (triggerAutoload) {
      await ensureAllMatchesLoaded(filters, summary);
    }

    return summary;
  }

  async function sortGrid() {
    if (!gridEl) return;
    const key = currentSortKey();
    const rows = getItems();
    if (!rows.length) return;

    // Always sort on initial load to guarantee consistent ordering
    isInitialLoad = false;

    const cmp =
      {
        'rank-asc': (a, b) => rankFromNode(b) - rankFromNode(a),
        'rank-desc': (a, b) => rankFromNode(a) - rankFromNode(b),
        'name-asc': (a, b) => sortNameFromNode(a).localeCompare(sortNameFromNode(b)),
        'name-desc': (a, b) => sortNameFromNode(b).localeCompare(sortNameFromNode(a)),
      }[key] || ((a, b) => rankFromNode(a) - rankFromNode(b));

    // Use DocumentFragment to batch DOM updates (1 reflow instead of 182)
    const fragment = document.createDocumentFragment();
    rows.sort(cmp).forEach((el) => fragment.appendChild(el));
    gridEl.appendChild(fragment);
  }

  function getNextLinkAnchor() {
    return document.querySelector('[data-next-page-link][rel="next"]');
  }

  allPagesLoaded = !getNextLinkAnchor();

  async function fetchAndAppendNextPage() {
    const nextA = getNextLinkAnchor();
    if (!nextA) return false;

    const url = nextA.getAttribute('href');
    if (!url) return false;
    try {
      const res = await fetch(url, { credentials: 'same-origin' });
      if (!res.ok) return false;
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      if (!appendCardsFromDoc(doc)) return false;
      const fetchedNext = doc.querySelector('[data-next-page-link][rel="next"]');
      if (fetchedNext) {
        nextA.setAttribute('href', fetchedNext.getAttribute('href'));
      } else {
        nextA.remove();
      }
      const pageIndex = pageIndexFromUrl(url);
      if (pageIndex !== null) fetchedPages.add(pageIndex);
      document.dispatchEvent(new CustomEvent('archive:items-appended'));
      return true;
    } catch (err) {
      console.error('Failed to append next page', err);
      return false;
    }
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
      if (p.country) {
        const cKey = slug(p.country);
        const cLabel = String(p.country).toUpperCase();
        countries.set(cKey, cLabel);
      }
      if (p.mainCharacter) {
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
        .find((k) => normalizeCharacterKey(k) === currentCharNorm);
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
        const sortKey = currentSortKey();
        await ensurePagesForSort(sortKey, filters);
        await sortGrid();
        await applyFilters(triggerAutoload, filters);
      })
      .then(() => {
        updateHistoryFromControls();
      })
      .catch((err) => {
        console.error(err);
      });
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
      // Auto-close is handled by the generic change handler above
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
  // Read URL parameters and pre-populate filters
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
      const availableSorts = Array.from(sortSelect.options).map(opt => opt.value);
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
        const match = options.find(opt => opt.value === normalizedCountry);
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
        const match = options.find(opt => normalizeCharacterKey(opt.value) === normalizedChar);
        characterSelect.value = match ? match.value : 'all';
      } else {
        characterSelect.value = 'all';
      }
    }
  }

  const initialParams = new URLSearchParams(window.location.search);
  renderSpotlight();
  populateFilterOptions();
  loadFiltersFromURL(initialParams);
  bindUI();
  window.addEventListener('popstate', () => {
    const params = new URLSearchParams(window.location.search);
    skipHistoryUpdate = true;
    loadFiltersFromURL(params);
    queueSortAndFilter();
  });
  queueSortAndFilter();
});
