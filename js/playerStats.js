const DEFAULT_PLAYER_STATS_ENDPOINT = '/data/player-stats-slim.json';

async function fetchPlayerStatsData() {
  if (Array.isArray(window.__playerStatsPreloaded)) {
    return window.__playerStatsPreloaded;
  }

  const endpoint =
    typeof window.playerStatsDataEndpoint === 'string' && window.playerStatsDataEndpoint.trim()
      ? window.playerStatsDataEndpoint
      : DEFAULT_PLAYER_STATS_ENDPOINT;

  const response = await fetch(endpoint, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`Player stats request failed (${response.status})`);
  }

  const payload = await response.json();
  const players = Array.isArray(payload?.players) ? payload.players : payload;

  if (!Array.isArray(players)) {
    throw new Error('Player stats payload is not an array.');
  }

  window.__playerStatsPreloaded = players;
  return players;
}

document.addEventListener('DOMContentLoaded', () => {
  if (!document.body.classList.contains('page-player-stats')) return;

  const table = document.getElementById('stats-table');
  const tableBody = table?.querySelector('tbody');
  const allHeaders = Array.from(table.querySelectorAll('thead th[data-key]'));
  const sortableHeaders = Array.from(table.querySelectorAll('thead th.sortable'));
  const searchInput = document.getElementById('player-search-input');
  const searchClearBtn = document.getElementById('player-search-clear-btn');
  const resultsCountEl = document.getElementById('results-count');
  const sentinel = document.getElementById('sentinel');
  const statFilterEl = document.getElementById('stat-filter');
  const operatorFilterEl = document.getElementById('operator-filter');
  const valueFilterEl = document.getElementById('value-filter');
  const resetFiltersBtn = document.getElementById('reset-filters-btn');
  const columnControlsWrapper = document.getElementById('column-controls-wrapper');
  const selectAllColsBtn = document.getElementById('select-all-cols');
  const deselectAllColsBtn = document.getElementById('deselect-all-cols');
  const howToUsePanel = document.getElementById('how-to-use-panel');
  const filterOptionsPanel = document.getElementById('filter-options-panel');
  const tabNav = document.querySelector('.tab-nav');
  const mobileHowToUseBtn = document.getElementById('mobile-how-to-use-btn');
  const mobileFilterOptionsBtn = document.getElementById('mobile-filter-options-btn');
  const howToUseCloseBtn = document.getElementById('how-to-use-close-btn');
  const filterOptionsCloseBtn = document.getElementById('filter-options-close-btn');
  const mobileCardsContainer = document.getElementById('stats-card-container');

  const showDataError = (message = 'Error: Player data could not be loaded.') => {
    if (!table) return;
    const tableBodyFallback = table.querySelector('tbody');
    if (tableBodyFallback) {
      tableBodyFallback.innerHTML = `<tr><td colspan="16">${message}</td></tr>`;
    }
  };

  if (!tableBody || !searchInput || !sortableHeaders.length || !tabNav) {
    console.error("Required elements for player stats page are missing.");
    return;
  }

  const initPlayerStatsPage = (playerProfiles) => {
    if (!Array.isArray(playerProfiles) || !playerProfiles.length) {
      showDataError();
      return;
    }

    const isMobile = () =>
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 767px)').matches
      : window.innerWidth <= 767;

  const toRankNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };

    const MIN_EVENTS_FOR_INCLUSION = 4;

    const getRecentEventCount = (player) => {
      if (!player || !Array.isArray(player.results_1yr)) return 0;
      return player.results_1yr.length;
    };

  const qualifiesForStats = (player) => {
    if (!player || typeof player !== 'object') return false;
    const rankNum = toRankNumber(player.rank);
    const isTop200 = rankNum !== null && rankNum > 0 && rankNum <= 200;
    return isTop200;
  };

    let allPlayers = [];
    let filteredPlayers = [];

    const INITIAL_VISIBLE_COUNT = isMobile() ? 12 : 40;
    const batchSize = isMobile() ? 18 : 50;
    let visibleCount = INITIAL_VISIBLE_COUNT;

  let state = {
    sortKey: 'fgpi',
    sortDir: 'desc',
    sortType: 'number',
    searchTerm: '',
    filter: { stat: '', operator: '>=', value: '' }
  };

  const allColumnKeys = allHeaders.map(h => h.dataset.key);
  const defaultVisibleColumns = [...allColumnKeys];
  const savedCols = JSON.parse(localStorage.getItem('visiblePlayerStatsColumns') || 'null');
  let visibleColumns =
    Array.isArray(savedCols) && savedCols.length
      ? savedCols.filter(k => allColumnKeys.includes(k))
      : [...defaultVisibleColumns];

  if (!Array.isArray(savedCols) || !savedCols.length) {
    localStorage.setItem('visiblePlayerStatsColumns', JSON.stringify(visibleColumns));
  }

    const statKeyMap = {
      rank: 'rank',
      player: 'name',
      fgpi: 'stats.FGPI',
      ms: 'stats.MS',
      pf: 'stats.PF',
      tdr: 'stats.TDR',
      v: 'stats.V',
      t3: 'stats.T3',
      t8: 'stats.T8',
      t16: 'stats.T16',
      app: 'stats.APP',
      apm: 'stats.APM',
      af12: 'stats.AF12',
      afm12: 'stats.AFM12',
      af6: 'stats.AF6',
      afm6: 'stats.AFM6'
    };

    const NUMERIC_STAT_KEYS = [
      'FGPI',
      'MS',
      'PF',
      'TDR',
      'V',
      'T3',
      'T8',
      'T16',
      'APP',
      'APM',
      'AF12',
      'AFM12',
      'AF6',
      'AFM6'
    ];

    const buildSearchTarget = (player) => {
      const pieces = [];
      if (player.name) pieces.push(String(player.name).toLowerCase());
      if (player.englishName) pieces.push(String(player.englishName).toLowerCase());
      if (player.slug) pieces.push(String(player.slug).toLowerCase());
      return pieces.join(' ').trim();
    };

    const buildNumericStatCache = (player) => {
      const cache = {};
      const source = player.stats || {};
      NUMERIC_STAT_KEYS.forEach((key) => {
        const value = parseFloat(source[key]);
        if (Number.isFinite(value)) {
          cache[key] = value;
        }
      });
      return cache;
    };

    const getNumericStatValue = (player, key) => {
      if (!player || !player._numericStats) return Number.NaN;
      return player._numericStats[key.toUpperCase()];
    };

  let filterWorkHandle = null;
  let filterWorkType = null;
  let renderWorkHandle = null;
  let renderWorkType = null;

  const cancelScheduledFilter = () => {
    if (filterWorkHandle === null) return;
    if (filterWorkType === 'idle' && typeof window.cancelIdleCallback === 'function') {
      window.cancelIdleCallback(filterWorkHandle);
    } else {
      clearTimeout(filterWorkHandle);
    }
    filterWorkHandle = null;
    filterWorkType = null;
  };

  const cancelScheduledRender = () => {
    if (renderWorkHandle === null) return;
    if (renderWorkType === 'raf' && typeof window.cancelAnimationFrame === 'function') {
      window.cancelAnimationFrame(renderWorkHandle);
    } else {
      clearTimeout(renderWorkHandle);
    }
    renderWorkHandle = null;
    renderWorkType = null;
  };

  const scheduleRenderWork = ({ immediate = false, fromPopstate = false } = {}) => {
    if (immediate) {
      cancelScheduledRender();
      renderData({ fromPopstate });
      return;
    }

    cancelScheduledRender();
    const run = () => {
      renderWorkHandle = null;
      renderWorkType = null;
      renderData({ fromPopstate });
    };

    if (typeof window.requestAnimationFrame === 'function') {
      renderWorkType = 'raf';
      renderWorkHandle = window.requestAnimationFrame(run);
    } else {
      renderWorkType = 'timeout';
      renderWorkHandle = setTimeout(run, 16);
    }
  };

  const requestDataRefresh = ({ immediate = false, fromPopstate = false } = {}) => {
    if (immediate) {
      cancelScheduledFilter();
      cancelScheduledRender();
      recomputeFilteredPlayers();
      renderData({ fromPopstate });
      return;
    }

    cancelScheduledFilter();

    const runFilter = () => {
      filterWorkHandle = null;
      filterWorkType = null;
      recomputeFilteredPlayers();
      scheduleRenderWork({ fromPopstate });
    };

    if (typeof window.requestIdleCallback === 'function') {
      filterWorkType = 'idle';
      filterWorkHandle = window.requestIdleCallback(runFilter, { timeout: isMobile() ? 180 : 100 });
    } else {
      filterWorkType = 'timeout';
      filterWorkHandle = setTimeout(runFilter, isMobile() ? 60 : 0);
    }
  };

  const debounce = (fn, delay = 300) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  };

    const calculateStatRankings = (players) => {
      const statKeys = [
        'FGPI',
        'AF12',
        'AFM12',
        'AF6',
        'AFM6',
        'APP',
        'APM',
        'TDR',
        'PF',
        'MS',
        'V',
        'T3',
        'T8',
        'T16'
      ];
      const isHigherBetter = (key) =>
        !['AF12', 'AFM12', 'AF6', 'AFM6'].includes(key);

      const rankings = {};

      for (const key of statKeys) {
        const values = players
          .map(p => getNumericStatValue(p, key))
          .filter(v => Number.isFinite(v));

        if (!values.length) {
          rankings[key] = new Map();
          continue;
        }

        values.sort((a, b) => (isHigherBetter(key) ? b - a : a - b));
        const map = new Map();
        let pos = 1;

        for (let i = 0; i < values.length; ) {
          const v = values[i];
          let j = i + 1;
          while (j < values.length && values[j] === v) j++;
          if (!map.has(v)) map.set(v, pos);
          pos += (j - i);
          i = j;
        }

        rankings[key] = map;
      }

      return rankings;
    };

  function wireAvatar(container) {
    const img = container.querySelector('img.player-icon');
    const ph = container.querySelector('.player-placeholder-icon');
    if (!ph) return;

    const setState = (mode) => {
      container.classList.toggle('show-image', mode === 'image');
      container.classList.toggle('show-placeholder', mode === 'placeholder');
      if (img) img.style.display = (mode === 'image') ? 'block' : 'none';
      ph.style.display = (mode === 'image') ? 'none' : 'flex';
    };

    if (!img) {
      setState('placeholder');
      return;
    }

    setState('image');

    const showPlaceholder = () => setState('placeholder');
    const showImage = () => setState('image');

    if (img.complete) {
      (img.naturalWidth > 0) ? showImage() : showPlaceholder();
    } else {
      img.addEventListener('load', showImage, { once: true });
      img.addEventListener('error', showPlaceholder, { once: true });
    }
  }

  function initAvatars(scope = document) {
    scope
      .querySelectorAll('.player-cell-content, .spotlight-player-icon-wrapper')
      .forEach(wireAvatar);
  }

  const createRowHtml = (player, statRankings) => {
    let rowRankClass = '';
    let isRank6to20 = false;

    if (Number.isFinite(player.rank)) {
      if (player.rank >= 1 && player.rank <= 5) {
        rowRankClass = `rank-${player.rank}`;
      } else if (player.rank >= 6 && player.rank <= 20) {
        isRank6to20 = true;
      }
    }

    const getStatValue = (statKey) => {
      if (!player.stats) return 'N/A';
      const v = player.stats[statKey.toUpperCase()];
      return (v === null || v === undefined || v === '') ? 'N/A' : v;
    };

    const getStatRankClass = (statKey, value) => {
      const v = parseFloat(value);
      if (!Number.isFinite(v)) return '';
      const map = statRankings[statKey.toUpperCase()];
      if (!map) return '';
      const pos = map.get(v);
      return pos && pos <= 5 ? `rank-${pos}` : '';
    };

    return `<tr class="${rowRankClass}">
<td data-key="rank" class="rank-cell ${isRank6to20 ? 'ranked-6-20' : ''}">${player.rank || 'N/A'}</td>
<td data-key="player" data-cell="player" class="col-player ${isRank6to20 ? 'ranked-6-20' : ''}">
  <div class="player-cell-content">
    <a href="/players/${player.slug}/">
      <span>${player.englishName ? `${player.name} (${player.englishName})` : player.name}</span>
    </a>
  </div>
</td>
<td data-key="fgpi" class="${getStatRankClass('fgpi', getStatValue('fgpi'))}">${getStatValue('fgpi')}</td>
<td data-key="ms"   class="${getStatRankClass('ms',   getStatValue('ms'))}">${getStatValue('ms')}</td>
<td data-key="pf"   class="${getStatRankClass('pf',   getStatValue('pf'))}">${getStatValue('pf')}</td>
<td data-key="tdr"  class="${getStatRankClass('tdr',  getStatValue('tdr'))}">${getStatValue('tdr')}</td>
<td data-key="v"    class="${getStatRankClass('v',    getStatValue('v'))}">${getStatValue('v')}</td>
<td data-key="t3"   class="${getStatRankClass('t3',   getStatValue('t3'))}">${getStatValue('t3')}</td>
<td data-key="t8"   class="${getStatRankClass('t8',   getStatValue('t8'))}">${getStatValue('t8')}</td>
<td data-key="t16"  class="${getStatRankClass('t16',  getStatValue('t16'))}">${getStatValue('t16')}</td>
<td data-key="app"  class="${getStatRankClass('app',  getStatValue('app'))}">${getStatValue('app')}</td>
<td data-key="apm"  class="${getStatRankClass('apm',  getStatValue('apm'))}">${getStatValue('apm')}</td>
<td data-key="af12" class="${getStatRankClass('af12', getStatValue('af12'))}">${getStatValue('af12')}</td>
<td data-key="afm12"class="${getStatRankClass('afm12',getStatValue('afm12'))}">${getStatValue('afm12')}</td>
<td data-key="af6"  class="${getStatRankClass('af6',  getStatValue('af6'))}">${getStatValue('af6')}</td>
<td data-key="afm6" class="${getStatRankClass('afm6', getStatValue('afm6'))}">${getStatValue('afm6')}</td>
</tr>`;
  };

  // --- MOBILE CARD VIEW HELPERS (with rank/stat styling) ---------------------

  const createCardHtml = (player, statRankings) => {
    const rankLabel = player.rank ? `#${player.rank}` : 'N/A';

    // Mirror table rank logic
    let rankClass = '';
    let cardRankClass = '';
    let isRank6to20 = false;
    if (Number.isFinite(player.rank)) {
      if (player.rank >= 1 && player.rank <= 5) {
        rankClass = `rank-${player.rank}`;
        cardRankClass = `rank-${player.rank}-card`;
      } else if (player.rank >= 6 && player.rank <= 20) {
        isRank6to20 = true;
      }
    }

    const getStatValue = (statKey) => {
      if (!player.stats) return 'N/A';
      const v = player.stats[statKey.toUpperCase()];
      return (v === null || v === undefined || v === '') ? 'N/A' : v;
    };

    const getStatRankClass = (statKey) => {
      const value = getStatValue(statKey);
      const v = parseFloat(value);
      if (!Number.isFinite(v)) return '';
      const map = statRankings[statKey.toUpperCase()];
      if (!map) return '';
      const pos = map.get(v);
      return pos && pos <= 5 ? `rank-${pos}` : '';
    };

    const metaParts = [];
    if (player.country) metaParts.push(player.country);
    if (player.mainCharacter) metaParts.push(player.mainCharacter);
    const metaText = metaParts.join(' · ');

    return `
<div class="player-stat-card ${cardRankClass}" data-player-slug="${player.slug}">
  <div class="player-stat-card__header">
    <div class="player-stat-card__rank ${rankClass} ${isRank6to20 ? 'ranked-6-20' : ''}">${rankLabel}</div>
    <div>
      <div class="player-stat-card__name">
        <a href="/players/${player.slug}/">${player.name}</a>
      </div>
      ${metaText ? `<div class="player-stat-card__meta">${metaText}</div>` : ''}
    </div>
  </div>

  <div>
    <div class="player-stat-card__section-title player-stat-card__section-title--core">Core Ratings</div>
    <div class="player-stat-card__grid">
      <div class="player-stat-card__stat">
        <span class="player-stat-card__stat-label">FGPI</span>
        <span class="player-stat-card__stat-value ${getStatRankClass('fgpi')}">${getStatValue('fgpi')}</span>
      </div>
      <div class="player-stat-card__stat">
        <span class="player-stat-card__stat-label">MS</span>
        <span class="player-stat-card__stat-value ${getStatRankClass('ms')}">${getStatValue('ms')}</span>
      </div>
      <div class="player-stat-card__stat">
        <span class="player-stat-card__stat-label">PF</span>
        <span class="player-stat-card__stat-value ${getStatRankClass('pf')}">${getStatValue('pf')}</span>
      </div>
      <div class="player-stat-card__stat">
        <span class="player-stat-card__stat-label">TDR</span>
        <span class="player-stat-card__stat-value ${getStatRankClass('tdr')}">${getStatValue('tdr')}</span>
      </div>
    </div>
  </div>

  <div>
    <div class="player-stat-card__section-title player-stat-card__section-title--core">Results (12 Mo.)</div>
    <div class="player-stat-card__grid">
      <div class="player-stat-card__stat">
        <span class="player-stat-card__stat-label">V</span>
        <span class="player-stat-card__stat-value ${getStatRankClass('v')}">${getStatValue('v')}</span>
      </div>
      <div class="player-stat-card__stat">
        <span class="player-stat-card__stat-label">T3</span>
        <span class="player-stat-card__stat-value ${getStatRankClass('t3')}">${getStatValue('t3')}</span>
      </div>
      <div class="player-stat-card__stat">
        <span class="player-stat-card__stat-label">T8</span>
        <span class="player-stat-card__stat-value ${getStatRankClass('t8')}">${getStatValue('t8')}</span>
      </div>
      <div class="player-stat-card__stat">
        <span class="player-stat-card__stat-label">T16</span>
        <span class="player-stat-card__stat-value ${getStatRankClass('t16')}">${getStatValue('t16')}</span>
      </div>
    </div>
  </div>

  <button class="player-stat-card__more-toggle" type="button">
    More stats
    <i class="fas fa-chevron-down" aria-hidden="true"></i>
  </button>

  <div class="player-stat-card__more">
    <div class="player-stat-card__section-title player-stat-card__section-title--core">Average Finish</div>
    <div class="player-stat-card__grid">
      <div class="player-stat-card__stat">
        <span class="player-stat-card__stat-label">AF12</span>
        <span class="player-stat-card__stat-value ${getStatRankClass('af12')}">${getStatValue('af12')}</span>
      </div>
      <div class="player-stat-card__stat">
        <span class="player-stat-card__stat-label">AFM12</span>
        <span class="player-stat-card__stat-value ${getStatRankClass('afm12')}">${getStatValue('afm12')}</span>
      </div>
      <div class="player-stat-card__stat">
        <span class="player-stat-card__stat-label">AF6</span>
        <span class="player-stat-card__stat-value ${getStatRankClass('af6')}">${getStatValue('af6')}</span>
      </div>
      <div class="player-stat-card__stat">
        <span class="player-stat-card__stat-label">AFM6</span>
        <span class="player-stat-card__stat-value ${getStatRankClass('afm6')}">${getStatValue('afm6')}</span>
      </div>
      <div class="player-stat-card__stat">
        <span class="player-stat-card__stat-label">APP</span>
        <span class="player-stat-card__stat-value ${getStatRankClass('app')}">${getStatValue('app')}</span>
      </div>
      <div class="player-stat-card__stat">
        <span class="player-stat-card__stat-label">APM</span>
        <span class="player-stat-card__stat-value ${getStatRankClass('apm')}">${getStatValue('apm')}</span>
      </div>
    </div>
  </div>
</div>`;
  };

  let baseStatRankings = new Map(); // Will be calculated after players are loaded

  // Event handler for "More stats" toggle - using event delegation
  const handleMoreToggleClick = (e) => {
    const btn = e.target.closest('.player-stat-card__more-toggle');
    if (!btn) return;

    const more = btn.nextElementSibling;
    if (!more) return;

    const isOpen = more.classList.toggle('is-open');
    const icon = btn.querySelector('i');

    if (isOpen) {
      btn.childNodes[0].textContent = 'Hide extra stats ';
      if (icon) icon.className = 'fas fa-chevron-up';
    } else {
      btn.childNodes[0].textContent = 'More stats ';
      if (icon) icon.className = 'fas fa-chevron-down';
    }
  };

  const updateSentinelVisibility = () => {
    if (!sentinel) return;
    sentinel.style.display =
      visibleCount < filteredPlayers.length ? 'block' : 'none';
  };

  const renderMobileCards = () => {
    if (!mobileCardsContainer) return;

    const count = Math.min(visibleCount, filteredPlayers.length);

    // Update results count
    if (resultsCountEl) {
      resultsCountEl.textContent =
        `Showing ${count} of ${filteredPlayers.length} qualified players`;
    }

    const cardsHtml = filteredPlayers
      .slice(0, count)
      .map(player => createCardHtml(player, baseStatRankings))
      .join('');

    mobileCardsContainer.innerHTML = cardsHtml;

    // Wire "More stats" toggles - event delegation
    if (!mobileCardsContainer._hasToggleListener) {
      mobileCardsContainer.addEventListener('click', handleMoreToggleClick);
      mobileCardsContainer._hasToggleListener = true;
    }

    updateSentinelVisibility();
  };

  // HYBRID HISTORY STRATEGY:
  // - Push for navigational changes (query/filters)
  // - Replace for presentation-only changes (sort)
  const updateUrlAndTitle = (opts = {}) => {
    const { fromPopstate = false } = opts;

    const next = new URLSearchParams();
    if (state.sortKey !== 'fgpi' || state.sortDir !== 'desc') {
      next.set('sort', state.sortKey);
      next.set('dir', state.sortDir);
    }
    if (state.searchTerm) next.set('q', state.searchTerm);
    if (state.filter.stat && state.filter.value !== '') {
      next.set('filter_stat', state.filter.stat);
      next.set('filter_op', state.filter.operator);
      next.set('filter_val', state.filter.value);
    }
    const newUrl = `${location.pathname}${next.toString() ? `?${next}` : ''}`;

    if (!fromPopstate) {
      const prev = new URLSearchParams(location.search);
      const prevNonSort = new URLSearchParams(prev);
      prevNonSort.delete('sort');
      prevNonSort.delete('dir');
      const nextNonSort = new URLSearchParams(next);
      nextNonSort.delete('sort');
      nextNonSort.delete('dir');

      const onlySortChanged =
        prevNonSort.toString() === nextNonSort.toString() &&
        (prev.get('sort') !== next.get('sort') || prev.get('dir') !== next.get('dir'));

      const currentPathAndQuery = location.pathname + location.search;
      if (currentPathAndQuery !== newUrl) {
        if (onlySortChanged) {
          history.replaceState({ ...state }, '', newUrl);
        } else {
          history.pushState({ ...state }, '', newUrl);
        }
      }
    }

    let newTitle = "Street Fighter 6 Player Stats";
    if (state.searchTerm) newTitle = `Stats for "${state.searchTerm}"`;
    document.title = `${newTitle} | FGC Top Players`;
  };

  const applyStateFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    state.sortKey = params.get('sort') || 'fgpi';
    state.sortDir = params.get('dir') || 'desc';
    state.searchTerm = params.get('q') || '';
    state.filter.stat = params.get('filter_stat') || '';
    state.filter.operator = params.get('filter_op') || '>=';
    state.filter.value = params.get('filter_val') || '';

    searchInput.value = state.searchTerm;
    statFilterEl.value = state.filter.stat;
    operatorFilterEl.value = state.filter.operator;
    valueFilterEl.value = state.filter.value;

    const header = sortableHeaders.find(h => h.dataset.sort === state.sortKey);
    if (header) state.sortType = header.dataset.sortType || 'number';
  };

  const updateSortUI = () => {
    sortableHeaders.forEach(h => h.classList.remove('sorted', 'asc', 'desc'));
    const currentHeader = document.querySelector(`#stats-table th[data-sort="${state.sortKey}"]`);
    if (currentHeader) currentHeader.classList.add('sorted', state.sortDir);
  };

  const renderTable = () => {
    const count = Math.min(visibleCount, filteredPlayers.length);

    if (resultsCountEl) {
      resultsCountEl.textContent =
        `Showing ${count} of ${filteredPlayers.length} qualified players`;
    }

    // On mobile, only render cards
    if (isMobile()) {
      renderMobileCards();
      updateSentinelVisibility();
      return;
    }

    // Desktop/tablet: render table
    tableBody.innerHTML = filteredPlayers
      .slice(0, count)
      .map(player => createRowHtml(player, baseStatRankings))
      .join('');

    initAvatars(tableBody);

    // Sentinel only used for infinite scroll on non-mobile
    updateSentinelVisibility();

    applyColumnVisibility();
    if (typeof initStatsTableTooltips === 'function') {
      initStatsTableTooltips();
    }
  };

  const recomputeFilteredPlayers = () => {
    const searchTermLower = state.searchTerm.trim().toLowerCase();
    let tempPlayers = searchTermLower
      ? allPlayers.filter(p => {
          const target = p._searchTarget;
          return target ? target.includes(searchTermLower) : false;
        })
      : [...allPlayers];

    const { stat, operator, value } = state.filter;
    const filterValueNum = parseFloat(value);
    if (stat && !isNaN(filterValueNum)) {
      tempPlayers = tempPlayers.filter(player => {
        const sv = getNumericStatValue(player, stat);
        if (!Number.isFinite(sv)) return false;
        switch (operator) {
          case '>=': return sv >= filterValueNum;
          case '<=': return sv <= filterValueNum;
          case '==': return sv === filterValueNum;
          default: return true;
        }
      });
    }

    filteredPlayers = tempPlayers;

    const sortPath = statKeyMap[state.sortKey] || 'rank';

    filteredPlayers.sort((a, b) => {
      let aVal;
      let bVal;

      if (sortPath.startsWith('stats.')) {
        const statKey = sortPath.split('.')[1];
        aVal = getNumericStatValue(a, statKey);
        bVal = getNumericStatValue(b, statKey);
      } else {
        aVal = a[sortPath];
        bVal = b[sortPath];
      }

      if (state.sortType === 'number') {
        const aParsed = Number(aVal);
        const bParsed = Number(bVal);

        const aIsNA =
          (aVal === null || aVal === undefined || aVal === '' || aVal === 'N/A' || !Number.isFinite(aParsed));
        const bIsNA =
          (bVal === null || bVal === undefined || bVal === '' || bVal === 'N/A' || !Number.isFinite(bParsed));

        if (aIsNA && bIsNA) return (a.rank || Infinity) - (b.rank || Infinity);
        if (aIsNA) return 1;
        if (bIsNA) return -1;

        return state.sortDir === 'asc' ? aParsed - bParsed : bParsed - aParsed;
      }

      const aStr = String(aVal || '').toLowerCase();
      const bStr = String(bVal || '').toLowerCase();

      if (aStr < bStr) return state.sortDir === 'asc' ? -1 : 1;
      if (aStr > bStr) return state.sortDir === 'asc' ? 1 : -1;
      return (a.rank || Infinity) - (b.rank || Infinity);
    });

  };

  const renderData = (opts = {}) => {
    const { fromPopstate = false } = opts;
    visibleCount = INITIAL_VISIBLE_COUNT;

    renderTable();
    updateSortUI();
    updateUrlAndTitle({ fromPopstate });
  };

  function applyColumnVisibility() {
    allHeaders.forEach(th => {
      th.style.display = visibleColumns.includes(th.dataset.key) ? '' : 'none';
    });

    Array.from(tableBody.querySelectorAll('tr')).forEach(tr => {
      Array.from(tr.children).forEach(td => {
        const key = td.dataset.key;
        td.style.display = visibleColumns.includes(key) ? '' : 'none';
      });
    });
  }

  function updateVisibleColumns() {
    visibleColumns = Array.from(
      columnControlsWrapper.querySelectorAll('input[type="checkbox"]:checked')
    ).map(cb => cb.dataset.columnKey);

    localStorage.setItem('visiblePlayerStatsColumns', JSON.stringify(visibleColumns));
    applyColumnVisibility();
  }

  function initializeColumnControls() {
    const primary = document.getElementById('column-checkboxes-primary');
    const secondary = document.getElementById('column-checkboxes-secondary');
    const tertiary = document.getElementById('column-checkboxes-tertiary');
    if (!primary || !secondary || !tertiary) return;

    const row1Keys = ['rank', 'player', 'fgpi', 'ms', 'pf', 'tdr'];
    const row2Keys = ['v', 't3', 't8', 't16', 'app', 'apm'];
    const row3Keys = ['af12', 'afm12', 'af6', 'afm6'];

    const createCheckbox = (header) => {
      const key = header.dataset.key;
      const isChecked = visibleColumns.includes(key);
      const labelText = header.querySelector('span')?.textContent || key.toUpperCase();

      const label = document.createElement('label');
      label.className = 'styled-checkbox-label';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.dataset.columnKey = key;
      checkbox.checked = isChecked;

      const box = document.createElement('div');
      box.className = 'styled-checkbox-box';

      const icon = document.createElement('i');
      icon.className = 'fas fa-check';

      const text = document.createElement('span');
      text.className = 'styled-checkbox-text';
      text.textContent = labelText;

      box.appendChild(icon);
      label.appendChild(checkbox);
      label.appendChild(box);
      label.appendChild(text);

      return label;
    };

    primary.innerHTML = '';
    secondary.innerHTML = '';
    tertiary.innerHTML = '';

    const headerMap = new Map();
    allHeaders.forEach(h => headerMap.set(h.dataset.key, h));

    row1Keys.forEach(key => {
      const h = headerMap.get(key);
      if (h) primary.appendChild(createCheckbox(h));
    });
    row2Keys.forEach(key => {
      const h = headerMap.get(key);
      if (h) secondary.appendChild(createCheckbox(h));
    });
    row3Keys.forEach(key => {
      const h = headerMap.get(key);
      if (h) tertiary.appendChild(createCheckbox(h));
    });
  }

  sortableHeaders.forEach(header => {
    header.addEventListener('click', (e) => {
      const sortKey = e.currentTarget.dataset.sort;
      const sortType = e.currentTarget.dataset.sortType;
      const defaultSort = e.currentTarget.dataset.sortDefault;

      if (state.sortKey === sortKey) {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortKey = sortKey;
        state.sortDir = defaultSort || 'asc';
        state.sortType = sortType || 'number';
      }

      requestDataRefresh({ immediate: true });
    });
  });

  const triggerSearchRefresh = debounce(() => {
    requestDataRefresh();
  }, isMobile() ? 220 : 140);

  searchInput.addEventListener('input', () => {
    state.searchTerm = searchInput.value;
    triggerSearchRefresh();
  });

  searchInput.addEventListener('input', () => {
    if (searchClearBtn) {
      searchClearBtn.classList.toggle('visible', searchInput.value.length > 0);
    }
  });

  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
      searchInput.value = '';
      state.searchTerm = '';
      searchClearBtn.classList.remove('visible');
      requestDataRefresh({ immediate: true });
    });
  }

  let filterRenderTimeout = null;

  const filterHandler = () => {
    // Update state immediately so dropdown reflects change
    state.filter.stat = statFilterEl.value;
    state.filter.operator = operatorFilterEl.value;
    state.filter.value = valueFilterEl.value;

    // Cancel any pending render to avoid redundant work
    if (filterRenderTimeout) {
      clearTimeout(filterRenderTimeout);
    }

    // Schedule render after browser paints dropdown change
    // Using 1ms instead of 0 ensures it runs in next event loop tick
    filterRenderTimeout = setTimeout(() => {
      filterRenderTimeout = null;
      requestDataRefresh();
    }, 1);
  };

  [statFilterEl, operatorFilterEl].forEach(el =>
    el.addEventListener('change', filterHandler)
  );
  valueFilterEl.addEventListener('input', debounce(filterHandler, 150));

  resetFiltersBtn.addEventListener('click', () => {
    searchInput.value = '';
    statFilterEl.value = '';
    operatorFilterEl.value = '>=';
    valueFilterEl.value = '';

    state.searchTerm = '';
    state.filter.stat = '';
    state.filter.operator = '>=';
    state.filter.value = '';

    requestDataRefresh({ immediate: true });
  });

  columnControlsWrapper.addEventListener('change', (e) => {
    if (e.target.type === 'checkbox') updateVisibleColumns();
  });

  selectAllColsBtn.addEventListener('click', () => {
    columnControlsWrapper
      .querySelectorAll('input[type="checkbox"]')
      .forEach(cb => (cb.checked = true));
    updateVisibleColumns();
  });

  deselectAllColsBtn.addEventListener('click', () => {
    columnControlsWrapper
      .querySelectorAll('input[type="checkbox"]')
      .forEach(cb => (cb.checked = false));
    updateVisibleColumns();
  });

  // Close button handlers
  if (howToUseCloseBtn) {
    howToUseCloseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      howToUsePanel.classList.remove('is-visible');
    });
  }

  if (filterOptionsCloseBtn) {
    filterOptionsCloseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      filterOptionsPanel.classList.remove('is-visible');
    });
  }

  tabNav.addEventListener('click', (e) => {
    const clickedTab = e.target.closest('.tab-btn');
    if (!clickedTab) return;

    tabNav
      .querySelectorAll('.tab-btn')
      .forEach(btn => btn.classList.remove('is-active'));
    document
      .querySelectorAll('.tab-content')
      .forEach(panel => panel.classList.remove('is-active'));

    clickedTab.classList.add('is-active');
    const targetPanelId = clickedTab.dataset.tabTarget;
    document.getElementById(targetPanelId).classList.add('is-active');

    if (targetPanelId === 'display-tab-content') {
      const anyBoxes = columnControlsWrapper.querySelector('.styled-checkbox-label');
      if (!anyBoxes) {
        initializeColumnControls();
        applyColumnVisibility();
      }
    }
  });

  // Mobile "How to Use" button handler
  if (mobileHowToUseBtn && howToUsePanel) {
    console.log('✓ How to Use button found and event listener attached');
    mobileHowToUseBtn.addEventListener('click', (e) => {
      console.log('How to Use button clicked');
      e.stopPropagation();
      howToUsePanel.classList.toggle('is-visible');
      filterOptionsPanel.classList.remove('is-visible');
    });
  } else {
    console.warn('How to Use button or panel not found:', {
      mobileHowToUseBtn,
      howToUsePanel
    });
  }

  // Mobile "Filter & Display" button handler
  if (mobileFilterOptionsBtn && filterOptionsPanel) {
    console.log('✓ Filter & Display button found and event listener attached');
    mobileFilterOptionsBtn.addEventListener('click', (e) => {
      console.log('Filter & Display button clicked');
      e.stopPropagation();

      // Show panel immediately
      filterOptionsPanel.classList.toggle('is-visible');
      howToUsePanel.classList.remove('is-visible');

      // Defer initialization work to keep UI responsive
      if (filterOptionsPanel.classList.contains('is-visible')) {
        requestAnimationFrame(() => {
          const displayTabBtn = tabNav.querySelector('[data-tab-target="display-tab-content"]');
          const displayTabActive = displayTabBtn?.classList.contains('is-active');
          const anyBoxes = columnControlsWrapper.querySelector('.styled-checkbox-label');
          if (!anyBoxes && displayTabActive) {
            initializeColumnControls();
            applyColumnVisibility();
          }
        });
      }
    });
  } else {
    console.warn('Filter & Display button or panel not found:', {
      mobileFilterOptionsBtn,
      filterOptionsPanel
    });
  }

  document.addEventListener('click', (e) => {
    // Close "How to Use" panel if clicking outside
    if (
      howToUsePanel.classList.contains('is-visible') &&
      !howToUsePanel.contains(e.target) &&
      (!mobileHowToUseBtn || !mobileHowToUseBtn.contains(e.target))
    ) {
      howToUsePanel.classList.remove('is-visible');
    }
    // Close filter panel if clicking outside
    if (
      filterOptionsPanel.classList.contains('is-visible') &&
      !filterOptionsPanel.contains(e.target) &&
      (!mobileFilterOptionsBtn || !mobileFilterOptionsBtn.contains(e.target))
    ) {
      filterOptionsPanel.classList.remove('is-visible');
    }
  });

  window.addEventListener('popstate', () => {
    applyStateFromUrl();

    searchInput.value = state.searchTerm || '';
    if (searchClearBtn) {
      searchClearBtn.classList.toggle('visible', searchInput.value.length > 0);
    }

    const header = sortableHeaders.find(h => h.dataset.sort === state.sortKey);
    if (header) state.sortType = header.dataset.sortType || 'number';

    statFilterEl.value = state.filter.stat || '';
    operatorFilterEl.value = state.filter.operator || '>=';
    valueFilterEl.value = state.filter.value || '';

    requestDataRefresh({ immediate: true, fromPopstate: true });

    const tw = document.querySelector('.table-wrapper');
    (tw ? tw : window).scrollTo({ top: 0, behavior: 'auto' });
  });

  const getMobilePreloadMargin = () => {
    const viewportBoost = (window.innerHeight || 800) * 2;
    if (!mobileCardsContainer) return Math.max(2400, viewportBoost);
    const card = mobileCardsContainer.querySelector('.player-stat-card');
    const height = (card && card.getBoundingClientRect().height) || 220;
    return Math.max(2400, viewportBoost, Math.round(height * 12));
  };

  const getObserverOptions = () =>
    isMobile()
      ? { threshold: 0, rootMargin: `0px 0px ${getMobilePreloadMargin()}px 0px` }
      : { threshold: 1.0, rootMargin: '0px' };

  const handleSentinelIntersect = entries => {
    const entry = entries[0];
    if (!entry?.isIntersecting || visibleCount >= filteredPlayers.length) return;
    visibleCount += batchSize;
    if (isMobile()) {
      renderMobileCards();
    } else {
      renderTable();
    }
  };

  let infiniteObserver;
  const initInfiniteObserver = () => {
    if (!sentinel) return;
    if (infiniteObserver) infiniteObserver.disconnect();
    infiniteObserver = new IntersectionObserver(handleSentinelIntersect, getObserverOptions());
    infiniteObserver.observe(sentinel);
  };

  const refreshObserver = debounce(() => {
    initInfiniteObserver();
  }, 200);

  window.addEventListener('resize', refreshObserver);

  // Defer ALL heavy initialization to keep page interactive
  // Break work into chunks to avoid blocking user interactions
  const scheduleWork = (fn) => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(fn, { timeout: 100 });
    } else {
      setTimeout(fn, 0);
    }
  };

    scheduleWork(() => {
      // Process player data
      const preparedPlayers = playerProfiles.map(player => {
        const numericRank = toRankNumber(player.rank);
        const normalizedEvents = getRecentEventCount(player);
        return {
          ...player,
          rank: numericRank !== null ? numericRank : player.rank,
          eventsCount: normalizedEvents,
          _searchTarget: buildSearchTarget(player),
          _numericStats: buildNumericStatCache(player)
        };
      });
      allPlayers = preparedPlayers.filter(qualifiesForStats);
      filteredPlayers = [...allPlayers];

      // Calculate stat rankings for top 5 styling
      baseStatRankings = calculateStatRankings(allPlayers);

      // Apply URL state in next chunk
      scheduleWork(() => {
        applyStateFromUrl();

        // Seed initial history state
        window.history.replaceState(
          { ...state },
          '',
          window.location.pathname + window.location.search
        );

        // Render content in next chunk to avoid blocking
        scheduleWork(() => {
          requestDataRefresh({ immediate: true });
          initInfiniteObserver();

          if (searchClearBtn) {
            searchClearBtn.classList.toggle('visible', searchInput.value.length > 0);
          }
        });
      });
    });
  };

  fetchPlayerStatsData()
    .then(initPlayerStatsPage)
    .catch((error) => {
      console.error('Failed to load player stats data:', error);
      showDataError();
    });
});
