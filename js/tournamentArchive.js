(function () {
  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => Array.from(p.querySelectorAll(s));
  const SEARCH_PARAM = "trs";
  const LEGACY_SEARCH_PARAM = "q";

  function toEpoch(dateStr) {
    if (!dateStr || typeof dateStr !== "string") return 0;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, d] = dateStr.split("-").map(Number);
      return Date.UTC(y, m - 1, d);
    }
    const t = Date.parse(dateStr);
    return Number.isNaN(t) ? 0 : t;
  }

  function debounce(fn, ms = 120) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), ms);
    };
  }

  const listEl       = $("#archive-list");
  const searchInput  = $("#search-input");
  const clearBtn     = $("#search-clear-btn");
  const yearSelect   = $("#year-filter");
  const ratedOnly    = $("#rated-only-filter");
  const sortSelect   = $("#sort-by");
  const countEl      = $("#results-count");
  const noResults    = $("#no-results-message");
  const inlineResetBtn = $("#reset-filters-btn");
  const clearFiltersBtn = $("#clear-filters-btn");
  const TOURNAMENT_API_URL = "/api/tournament-results.json";
  let tournamentDataFetchPromise = null;
  let isTournamentDataReady = false;

  // Filter toggle for mobile/tablet
  const filterToggleBtn = $('#filter-toggle-btn-tournament');
  const filterForm = $('#archive-filters-form');
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
      // Only auto-close on mobile (≤767px)
      if (target.matches(autoCloseSelector) && isMobileQuery.matches) {
        closeFilterForm();
      }
    });

    // Close filter form when search submit button (magnifying glass) is clicked
    const searchSubmitBtn = $('#search-submit-btn');
    if (searchSubmitBtn) {
      searchSubmitBtn.addEventListener('click', () => {
        closeFilterForm();
      });
    }
  }

  const TIER_CLASSES = ["t-event-card--s-plus","t-event-card--s","t-event-card--a","t-event-card--b"];
  const TIER_RATING_ORDER = {
    "S+": 4,
    "S": 3,
    "A": 2,
    "B": 1,
  };
  const RATING_SORTS = new Set(["rating-desc", "rating-asc"]);
  const isRatingSortMode = (mode) => RATING_SORTS.has(mode);
  const DEFAULT_SORT_MODE = "date-desc";
  let lastNonRatingSortMode = DEFAULT_SORT_MODE;
  let skipHistoryUpdate = false;

  let cardNavInitialized = false;
  function initCardNavigation() {
    if (cardNavInitialized || !listEl) return;

    listEl.addEventListener('click', (event) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      const ignore = event.target.closest('a, button');
      if (ignore) return;
      const card = event.target.closest('.t-event-card');
      if (!card) return;
      const slug = card.dataset.slug;
      if (!slug) return;
      window.location.href = `/tournaments/${slug}/`;
    });

    listEl.addEventListener('keydown', (event) => {
      if (event.defaultPrevented) return;
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const card = event.target.closest('.t-event-card');
      if (!card || event.target !== card) return;
      const slug = card.dataset.slug;
      if (!slug) return;
      event.preventDefault();
      event.stopPropagation();
      window.location.href = `/tournaments/${slug}/`;
    });

    cardNavInitialized = true;
  }

  function stripTierClasses(el) {
    TIER_CLASSES.forEach(cls => el.classList.remove(cls));
    el.className = el.className
      .split(/\s+/)
      .filter(c => !(c.startsWith("t-event-card--") && c !== "t-event-card"))
      .join(" ");
  }

  function neutralizeInline(el) {
    el.style.background = "var(--color-bg-dark)";
    el.style.borderColor = "#222";
    el.style.setProperty("border-left-color", "#333");
    el.style.opacity = "0.7";
  }

  let allNodes = [];
  let allTournamentData = [];
  const ITEMS_PER_PAGE = 15;

  async function fetchTournamentDataFromApi() {
    try {
      const response = await fetch(TOURNAMENT_API_URL, { cache: "no-store" });
      if (!response.ok) return [];
      const payload = await response.json();
      if (Array.isArray(payload?.events)) return payload.events;
      if (Array.isArray(payload)) return payload;
      return [];
    } catch (err) {
      console.warn("Unable to fetch tournament archive from API.", err);
      return [];
    }
  }

  function loadAllTournamentData() {
    if (allTournamentData.length > 0) {
      isTournamentDataReady = true;
      return Promise.resolve(allTournamentData);
    }
    const dataScript = document.getElementById("all-tournaments-data");
    if (dataScript) {
      try {
        allTournamentData = JSON.parse(dataScript.textContent);
        dataScript.remove();
        isTournamentDataReady = true;
        return Promise.resolve(allTournamentData);
      } catch (error) {
        console.error("Failed to parse inline tournament data:", error);
        dataScript.remove();
        allTournamentData = [];
      }
    }
    if (tournamentDataFetchPromise) return tournamentDataFetchPromise;
    tournamentDataFetchPromise = (async () => {
      const fetched = await fetchTournamentDataFromApi();
      allTournamentData = Array.isArray(fetched) ? fetched : [];
      isTournamentDataReady = true;
      tournamentDataFetchPromise = null;
      return allTournamentData;
    })();
    return tournamentDataFetchPromise;
  }

  function buildNodes() {
    if (!listEl) return [];
    const cards = $$(".t-event-card", listEl);
    return cards.map(article => {
      const dateIso = article.dataset.date || "";
      return {
        article,
        link: article,
        name: article.dataset.name || "",
        dateLabel: article.dataset.date || "",
        dateISO: dateIso,
        tier: normalizeTier(article.dataset.tier),
        slug: article.dataset.slug || "",
      };
    });
  }

  function markArchived(nodes) {
    const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000;
    nodes.forEach(n => {
      if (n.article.dataset.archivedChecked) return;
      const ts = toEpoch(n.dateISO || n.dateLabel);
      const isArchived = ts > 0 && ts < cutoff;
      n.article.dataset.archivedChecked = "1";
      if (isArchived) {
        n.article.classList.add("is-archived");
        n.article.dataset.archived = "1";
        stripTierClasses(n.article);
        n.article.dataset.tier = "";
        neutralizeInline(n.article);
      }
    });
  }

  const normalize = v => (v || "").toString().toLowerCase().trim();
  const normalizeTier = (value) => (value == null ? "" : String(value).trim().toUpperCase());
  const tierScore = (value) => TIER_RATING_ORDER[normalizeTier(value)] || 0;
  const compareNodesByDateAsc = (a, b) => toEpoch(a.dateISO || a.dateLabel) - toEpoch(b.dateISO || b.dateLabel);
  const compareNodesByDateDesc = (a, b) => compareNodesByDateAsc(b, a);
  const compareNodesByNameAsc = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  const compareDataByDateAsc = (a, b) => toEpoch(a.date) - toEpoch(b.date);
  const compareDataByDateDesc = (a, b) => compareDataByDateAsc(b, a);
  const compareDataByNameAsc = (a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" });
  const tierScoreFromData = (item) => tierScore(item?.Tier || item?.tier);

  function getNodeComparator(mode) {
    switch (mode) {
      case "date-asc":
        return compareNodesByDateAsc;
      case "date-desc":
        return compareNodesByDateDesc;
      case "name-asc":
        return compareNodesByNameAsc;
      default:
        return null;
    }
  }

  function getDataComparator(mode) {
    switch (mode) {
      case "date-asc":
        return compareDataByDateAsc;
      case "date-desc":
        return compareDataByDateDesc;
      case "name-asc":
        return compareDataByNameAsc;
      default:
        return null;
    }
  }

  function collectUniqueCards() {
    if (!listEl) return [];
    const nodes = $$(".t-event-card", listEl);
    const unique = [];
    const seenSlugs = new Set();

    nodes.forEach((card) => {
      const slug = card.dataset.slug;
      if (slug) {
        if (seenSlugs.has(slug)) {
          card.remove();
          return;
        }
        seenSlugs.add(slug);
      }
      unique.push(card);
    });
    return unique;
  }

  function getCardComparator(mode) {
    switch (mode) {
      case "date-asc":
        return (a, b) => compareNodesByDateAsc(
          { dateISO: a.dataset.date || "", dateLabel: a.dataset.date || "" },
          { dateISO: b.dataset.date || "", dateLabel: b.dataset.date || "" }
        );
      case "date-desc":
        return (a, b) => compareNodesByDateDesc(
          { dateISO: a.dataset.date || "", dateLabel: a.dataset.date || "" },
          { dateISO: b.dataset.date || "", dateLabel: b.dataset.date || "" }
        );
      case "name-asc":
        return (a, b) => compareNodesByNameAsc(
          { name: (a.dataset.name || "").toLowerCase() },
          { name: (b.dataset.name || "").toLowerCase() }
        );
      default:
        return null;
    }
  }

  function sortCurrentCards(requestedMode) {
    if (!listEl) return;
    const cards = collectUniqueCards();
    if (!cards.length) return;

    const baseMode = isRatingSortMode(requestedMode) ? lastNonRatingSortMode : requestedMode;
    const baseComparator = getCardComparator(baseMode);
    if (baseComparator) {
      cards.sort((a, b) => baseComparator(a, b));
    }

    if (isRatingSortMode(requestedMode)) {
      const baseOrder = new Map();
      cards.forEach((card, index) => baseOrder.set(card, index));

      cards.sort((a, b) => {
        let diff = tierScore(b.dataset.tier) - tierScore(a.dataset.tier);
        if (requestedMode === "rating-asc") diff = -diff;
        if (diff !== 0) return diff;
        return (baseOrder.get(a) ?? 0) - (baseOrder.get(b) ?? 0);
      });
    } else {
      lastNonRatingSortMode = requestedMode;
    }

    const fragment = document.createDocumentFragment();
    cards.forEach((card) => fragment.appendChild(card));
    listEl.innerHTML = "";
    listEl.appendChild(fragment);
    allNodes = buildNodes();
    markArchived(allNodes);
  }

  function toYear(n) {
    const ms = toEpoch(n.dateISO || n.dateLabel);
    return ms ? new Date(ms).getUTCFullYear().toString() : "";
  }

  function updateHistoryFromControls() {
    if (skipHistoryUpdate) {
      skipHistoryUpdate = false;
      return;
    }
    const params = new URLSearchParams();
    const searchValue = (searchInput?.value || '').trim();
    if (searchValue) params.set(SEARCH_PARAM, searchValue);

    const yearValue = yearSelect?.value || '';
    if (yearValue) params.set('year', yearValue);

    const ratedChecked = ratedOnly ? !!ratedOnly.checked : false;
    if (ratedChecked) params.set('rated', '1');

    const sortValue = sortSelect?.value || DEFAULT_SORT_MODE;
    if (sortValue !== DEFAULT_SORT_MODE) params.set('sort', sortValue);

    const newQuery = params.toString();
    const newUrl = `${window.location.pathname}${newQuery ? `?${newQuery}` : ''}`;
    const state = {
      q: searchValue,
      year: yearValue,
      rated: ratedChecked,
      sort: sortValue,
    };
    window.history.replaceState(state, '', newUrl);
  }

  function applyUrlParams(params) {
    const initialSearch = params.get(SEARCH_PARAM) || params.get(LEGACY_SEARCH_PARAM) || '';
    if (searchInput) {
      searchInput.value = initialSearch;
    }
    if (yearSelect) {
      const yearParam = params.get('year') || '';
      const availableYears = Array.from(yearSelect.options).map(opt => opt.value);
      yearSelect.value = yearParam && availableYears.includes(yearParam) ? yearParam : '';
    }
    if (ratedOnly) {
      ratedOnly.checked = params.get('rated') === '1';
    }
    if (sortSelect) {
      const sortParam = params.get('sort');
      const availableSorts = Array.from(sortSelect.options).map(opt => opt.value);
      if (sortParam && availableSorts.includes(sortParam)) {
        sortSelect.value = sortParam;
      } else {
        sortSelect.value = DEFAULT_SORT_MODE;
      }
    }
  }

  function applyFilters() {
    if (!allNodes.length && !listEl) return;
    const q = normalize(searchInput && searchInput.value);
    const year = yearSelect ? yearSelect.value : "";
    const wantRated = ratedOnly ? !!ratedOnly.checked : false;

    let visible = 0;
    allNodes.forEach(n => {
      let show = true;

      if (q) {
        const name = normalize(n.name);
        const dateLabel = normalize(n.dateLabel);
        show = name.includes(q) || dateLabel.includes(q);
      }
      if (show && year) show = toYear(n) === year;
      if (show && wantRated) {
        const t = (n.article.dataset.tier || "").toUpperCase();
        show = t === "S+" || t === "S" || t === "A" || t === "B";
      }

      n.link.style.display = show ? "" : "none";
      if (show) visible++;
    });

    if (countEl) countEl.textContent = `${visible} tournament${visible === 1 ? "" : "s"}`;
    if (noResults) {
      const none = visible === 0;
      noResults.style.display = none ? "" : "none";
      noResults.classList.toggle("no-results--visible", none);
    }
  }

  function createTournamentCard(tournament) {
    const tier = normalizeTier(tournament.Tier || tournament.tier);
    const isRatedTier = ['S+', 'S', 'A', 'B'].includes(tier);

    // Check if archived (older than 1 year)
    const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000;
    const ts = toEpoch(tournament.date);
    const isArchived = ts > 0 && ts < cutoff;

    let tierClass = '';
    if (isRatedTier && !isArchived) {
      const tierMap = { 'S+': 't-event-card--s-plus', 'S': 't-event-card--s', 'A': 't-event-card--a', 'B': 't-event-card--b' };
      tierClass = tierMap[tier] || '';
    }

    // Format date
    let formattedDate = 'TBD';
    if (tournament.date && /^\d{4}-\d{2}-\d{2}$/.test(tournament.date)) {
      const [y, m, d] = tournament.date.split('-').map(Number);
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      if (m >= 1 && m <= 12) {
        formattedDate = `${monthNames[m - 1]} ${d}, ${y}`;
      }
    }

    // Top 3 results
    const results = tournament.results || [];
    const top3 = results.filter(r => ['1', '2', '3'].includes(String(r.Finish || '')));

    let podiumHTML = '';
    if (top3.length > 0) {
      podiumHTML = '<ol class="t-card__podium-list">';
      top3.forEach(r => {
        const playerName = r.Player || 'Unknown';
        const finish = String(r.Finish || '');
        const placeLabel = finish === '1' ? '1st' : finish === '2' ? '2nd' : '3rd';
        podiumHTML += `
          <li class="t-podium-list__item">
            <span class="t-podium-list__place" aria-label="${placeLabel}">
              <i class="fas fa-trophy" aria-hidden="true"></i>
            </span>
            <span class="t-podium-list__name">${playerName}</span>
          </li>`;
      });
      podiumHTML += '</ol>';
    } else {
      podiumHTML = '<p class="t-card__no-results">Top 3 results coming soon.</p>';
    }

    const entrants = tournament.Entrants || tournament.entrants || '';
    const entrantsChip = entrants ? `<span class="t-card__chip"><i class="fas fa-users" aria-hidden="true"></i><span>${entrants} Entrants</span></span>` : '';

    let statusChip = '';
    if (isArchived) {
      statusChip = '<span class="t-card__chip t-card__chip--archived"><i class="fas fa-archive" aria-hidden="true"></i><span>Archived</span></span>';
    } else if (isRatedTier) {
      statusChip = '<span class="t-card__chip t-card__chip--rated"><i class="fas fa-star" aria-hidden="true"></i><span>Rated Event</span></span>';
    }

    const article = document.createElement('article');
    article.className = `t-event-card ${tierClass}${isArchived ? ' is-archived' : ''}`;
    article.setAttribute('role', 'link');
    article.setAttribute('tabindex', '0');
    article.setAttribute('aria-label', `View ${tournament.name} results`);
    article.dataset.slug = tournament.slug;
    article.dataset.date = tournament.date || '';
    article.dataset.name = tournament.name;
    article.dataset.tier = tier;
    article.dataset.archived = isArchived ? '1' : '0';
    article.dataset.dynamicCard = '1';  // Mark as dynamically created

    article.innerHTML = `
      <div class="t-card__body">
        <header class="t-card__head">
          <h3 class="t-card__title">
            <a href="/tournaments/${tournament.slug}/">${tournament.name}</a>
          </h3>
          <time class="t-card__date">${formattedDate}</time>
        </header>
        <div class="t-card__meta">
          ${entrantsChip}
          ${statusChip}
        </div>
        ${podiumHTML}
        <div class="t-card__cta">
          <a href="/tournaments/${tournament.slug}/" class="btn btn--primary btn--small">View Rated Results</a>
        </div>
      </div>`;

    return article;
  }

  function applySortAndRebuild() {
    if (!sortSelect || !listEl) return;
    const requestedMode = sortSelect.value || DEFAULT_SORT_MODE;
    sortCurrentCards(requestedMode);
  }

  function rebuildCardsFromData(dataArray) {
    return dataArray;
  }

  function applySort() {
    const requestedMode = sortSelect ? sortSelect.value : DEFAULT_SORT_MODE;
    sortCurrentCards(requestedMode);
    return Promise.resolve();
  }

  const runFiltersAndSort = debounce(() => {
    Promise.resolve(applySort()).then(() => {
      applyFilters();
      updateHistoryFromControls();
      if (clearBtn && searchInput) {
        const show = !!searchInput.value;
        clearBtn.classList.toggle("visible", show);
        clearBtn.setAttribute("aria-hidden", show ? "false" : "true");
      }
    });
  }, 120);

  function updateAndReapplyAll() {
    allNodes = buildNodes();
    if (!allNodes.length) return;
    markArchived(allNodes);
    applySort();
    applyFilters();
    updateHistoryFromControls();
  }

  /* ============================
     Width sizing helpers
     ============================ */
  function sizeSelectToLongest(select) {
    if (!select) return;
    const cs   = getComputedStyle(select);
    const font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = font;

    let max = 0;
    for (const opt of select.options) {
      const txt = opt.text || opt.textContent || "";
      const w = ctx.measureText(txt).width;
      if (w > max) max = w;
    }

    const toNum = v => parseFloat(v) || 0;
    const paddingL = toNum(cs.paddingLeft);
    const paddingR = toNum(cs.paddingRight);
    const borderL  = toNum(cs.borderLeftWidth);
    const borderR  = toNum(cs.borderRightWidth);
    const chevron  = 28;

    const final = Math.ceil(max + paddingL + paddingR + borderL + borderR + chevron);
    select.style.width = final + 'px';
    select.style.minWidth = final + 'px';
  }
  function sizeInputToReference(input) {
    if (!input) return;
    const refText = input.getAttribute('data-width-text') || input.placeholder || 'Search';
    const cs   = getComputedStyle(input);
    const font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = font;

    const textW = ctx.measureText(refText).width;

    const toNum = v => parseFloat(v) || 0;
    const paddingL = toNum(cs.paddingLeft);
    const paddingR = toNum(cs.paddingRight);
    const borderL  = toNum(cs.borderLeftWidth);
    const borderR  = toNum(cs.borderRightWidth);
    const clearBtnSize = 28;

    const final = Math.ceil(textW + paddingL + paddingR + borderL + borderR + clearBtnSize);
    input.style.width = final + 'px';
    input.style.minWidth = final + 'px';
  }

  function sizeAllControls() {
    sizeInputToReference(searchInput);
    sizeSelectToLongest(yearSelect);
    sizeSelectToLongest(sortSelect);
  }

  function resetAllFilters(options = {}) {
    const { focusSearch = false } = options;
    if (searchInput) {
      searchInput.value = "";
    }
    if (yearSelect) {
      yearSelect.value = "";
      sizeSelectToLongest(yearSelect);
    }
    if (ratedOnly) {
      ratedOnly.checked = false;
    }
    if (sortSelect) {
      sortSelect.value = DEFAULT_SORT_MODE;
      sizeSelectToLongest(sortSelect);
    }
    if (noResults) {
      noResults.classList.remove("no-results--visible");
      noResults.style.display = "none";
    }
    // Only auto-close on mobile (≤767px)
    const isMobileQuery = window.matchMedia('(max-width: 767px)');
    if (isMobileQuery.matches) {
      closeFilterForm();
    }
    runFiltersAndSort();
    if (focusSearch && searchInput) {
      searchInput.focus();
    }
  }

  /* ============================
     Initialization
     ============================ */
  function init() {
    if (!listEl) return;
    loadAllTournamentData().then(() => {
      // Re-evaluate with the full dataset once it's available.
      updateAndReapplyAll();
    });
    initCardNavigation();
    applyUrlParams(new URLSearchParams(window.location.search));
    updateAndReapplyAll();
    const yearWrap = yearSelect?.closest('.ac-field');
    const sortWrap = sortSelect?.closest('.ac-field');
    const searchWrap = searchInput?.closest('.ac-field');
    yearWrap && yearWrap.classList.add('shrink','select-wrap');
    sortWrap && sortWrap.classList.add('shrink','select-wrap');
    searchWrap && searchWrap.classList.add('shrink');
    sizeAllControls();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(sizeAllControls);
    }
    window.addEventListener('resize', sizeAllControls);

    if (searchInput) {
      searchInput.addEventListener("input", runFiltersAndSort);
      searchInput.addEventListener("change", runFiltersAndSort);
    }
    if (clearBtn && searchInput) {
      clearBtn.addEventListener("click", () => {
        searchInput.value = "";
        runFiltersAndSort();
        searchInput.focus();
      });
    }
    if (yearSelect)  yearSelect.addEventListener("change", () => { runFiltersAndSort(); sizeSelectToLongest(yearSelect); });
    if (ratedOnly)   ratedOnly.addEventListener("change", runFiltersAndSort);
    if (sortSelect)  sortSelect.addEventListener("change", () => {
      runFiltersAndSort();
      sizeSelectToLongest(sortSelect);
      // Auto-close handled by generic change handler
    });

    if (inlineResetBtn) {
      inlineResetBtn.addEventListener("click", () => resetAllFilters({ focusSearch: true }));
    }

    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener("click", () => resetAllFilters());
    }

    document.addEventListener("archive:items-appended", () => {
      requestAnimationFrame(() => {
        updateAndReapplyAll();
        sizeAllControls();
      });
    });

    window.__tArchive = {
      nodes: () => allNodes,
      reapply: () => { updateAndReapplyAll(); sizeAllControls(); }
    };
  }

  window.addEventListener('popstate', () => {
    const params = new URLSearchParams(window.location.search);
    applyUrlParams(params);
    skipHistoryUpdate = true;
    updateAndReapplyAll();
    sizeAllControls();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => requestAnimationFrame(init));
  } else {
    requestAnimationFrame(init);
  }
})();
