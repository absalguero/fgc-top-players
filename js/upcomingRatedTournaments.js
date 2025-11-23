(function () {
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const norm = (v) => (v == null ? "" : String(v)).toLowerCase().trim();
  const deb = (fn, d = 150) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), d); }; };

  const parseDate = (v) => {
    if (!v) return null;
    const d = new Date(v);
    if (!isNaN(d)) return d;
    return null;
  };

  const prizeToNumber = (v) => {
    if (!v) return 0;
    const s = String(v).toLowerCase().replace(/[, ]/g, "");
    if (/^\$?\d+(\.\d+)?k$/.test(s)) return parseFloat(s) * 1000;
    const n = parseFloat(s.replace(/[^0-9.]/g, ""));
    return isNaN(n) ? 0 : n;
  };
  const ratingOrder = {
    "S+": 4,
    "S": 3,
    "A": 2,
    "B": 1,
  };
  const normalizeTier = (value) =>
    value == null ? "" : String(value).trim().toUpperCase();
  const ratingScore = (tier) => ratingOrder[normalizeTier(tier)] || 0;
  const RATING_SORTS = new Set(["rating-desc", "rating-asc"]);
  let lastNonRatingSortMode = "date-asc";
  const isRatingSort = (mode) => RATING_SORTS.has(mode);

  const listEl  = $("#tournaments-list");
  const countEl = $("#results-count");
  const noResEl = $("#no-results-message");
  const inputEl = $("#search-input");
  const clearEl = $("#search-clear-btn");
  const sortEl  = $("#sort-by");
  const clearAllBtn = $("#clear-filters-btn");

  // Filter toggle for all screen sizes
  const filterToggleBtn = $("#filter-toggle-btn-upcoming");
  const controlsContainer = $("#upcoming-controls");
  const closeFilterPanel = () => {
    if (!filterToggleBtn || !controlsContainer) return;
    controlsContainer.classList.remove("is-open");
    filterToggleBtn.classList.remove("is-open");
    filterToggleBtn.setAttribute("aria-expanded", "false");
  };

  if (filterToggleBtn && controlsContainer) {
    filterToggleBtn.addEventListener("click", () => {
      const isOpen = controlsContainer.classList.toggle("is-open");
      filterToggleBtn.classList.toggle("is-open", isOpen);
      filterToggleBtn.setAttribute("aria-expanded", isOpen);
    });

    const autoCloseSelector = 'select, input[type="checkbox"], input[type="radio"]';
    controlsContainer.addEventListener('change', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!window.matchMedia('(max-width: 767px)').matches) return;
      if (target.matches(autoCloseSelector)) {
        closeFilterPanel();
      }
    });

    // Close filter panel when search submit button (magnifying glass) is clicked
    const searchSubmitBtn = $('#upcoming-search-submit-btn');
    if (searchSubmitBtn) {
      searchSubmitBtn.addEventListener('click', () => {
        closeFilterPanel();
      });
    }
  }

  if (!listEl) return;
  const cards = $$("#tournaments-list > .simple-card").map((el, idx) => {
    const ds = el.dataset || {};
    return {
      idx,
      el,
      name:       ds.name       || "",
      prizes:     ds.prizes     || "",
      startDate:  ds.startDate  || "",
      searchText: ds.searchText || "",
      tier:       normalizeTier(ds.tier),
    };
  });
  const readParams = () => {
    const p = new URLSearchParams(location.search);
    return { q: p.get("q") || "", sort: p.get("sort") || "date-asc" };
  };
  const writeParams = (q, sort) => {
    const p = new URLSearchParams(location.search);
    q ? p.set("q", q) : p.delete("q");
    sort ? p.set("sort", sort) : p.delete("sort");
    const next = `${location.pathname}${p.toString() ? "?" + p.toString() : ""}`;
    history.replaceState(null, "", next);
  };
  const matches = (model, term) => {
    const tokens = term.split(/\s+/).filter(Boolean);
    if (!tokens.length) return true;
    const hay = norm(model.searchText);
    return tokens.every(t => hay.includes(t));
  };
  const compareDateAsc = (a, b) => {
    const ad = parseDate(a.startDate) || new Date(8640000000000000);
    const bd = parseDate(b.startDate) || new Date(8640000000000000);
    if (ad < bd) return -1;
    if (ad > bd) return 1;
    return a.idx - b.idx;
  };
  const comparePrizeDesc = (a, b) => {
    const pa = prizeToNumber(a.prizes);
    const pb = prizeToNumber(b.prizes);
    if (pb !== pa) return pb - pa;
    return a.idx - b.idx;
  };
  const compareNameAsc = (a, b) => {
    const na = norm(a.name);
    const nb = norm(b.name);
    const c  = na.localeCompare(nb);
    return c || (a.idx - b.idx);
  };
  const compareRatingDesc = (a, b) => {
    const diff = ratingScore(b.tier) - ratingScore(a.tier);
    if (diff !== 0) return diff;
    return compareDateAsc(a, b);
  };
  const compareRatingAsc = (a, b) => {
    const diff = ratingScore(a.tier) - ratingScore(b.tier);
    if (diff !== 0) return diff;
    return compareDateAsc(a, b);
  };

  const cmp = {
    "date-asc": compareDateAsc,
    "rating-desc": compareRatingDesc,
    "rating-asc": compareRatingAsc,
    "prize-desc": comparePrizeDesc,
    "name-asc": compareNameAsc,
  };
  function sizeSelectToLongest(select) {
    if (!select) return;

    const cs   = getComputedStyle(select);
    const font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = font;

    let maxTextWidth = 0;
    for (const opt of select.options) {
      const text = opt.text || opt.textContent || "";
      const w = ctx.measureText(text).width;
      if (w > maxTextWidth) maxTextWidth = w;
    }

    const toNum = v => parseFloat(v) || 0;
    const paddingLeft  = toNum(cs.paddingLeft);
    const paddingRight = toNum(cs.paddingRight);
    const borderLeft   = toNum(cs.borderLeftWidth);
    const borderRight  = toNum(cs.borderRightWidth);

    const chevronSpace = 28;
    const final = Math.ceil(maxTextWidth + paddingLeft + paddingRight + borderLeft + borderRight + chevronSpace);

    select.style.width = final + 'px';
    select.style.minWidth = final + 'px';
  }
  function sizeInputToReference(input) {
    if (!input) return;
    const refText =
      input.getAttribute('data-width-text') ||
      input.placeholder ||
      'Search';

    const cs   = getComputedStyle(input);
    const font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = font;

    const textWidth = ctx.measureText(refText).width;

    const toNum = v => parseFloat(v) || 0;
    const paddingLeft  = toNum(cs.paddingLeft);
    const paddingRight = toNum(cs.paddingRight);
    const borderLeft   = toNum(cs.borderLeftWidth);
    const borderRight  = toNum(cs.borderRightWidth);

    const clearBtnSpace = 28;

    const final = Math.ceil(textWidth + paddingLeft + paddingRight + borderLeft + borderRight + clearBtnSpace);
    input.style.width = final + 'px';
    input.style.minWidth = final + 'px';
  }

  function apply() {
    const term = norm(inputEl?.value || "");
    const requestedSort = sortEl?.value || "date-asc";
    writeParams(term, requestedSort);

    const visible = [];
    for (const m of cards) {
      const ok = matches(m, term);
      m.el.style.display = ok ? "" : "none";
      if (ok) visible.push(m);
    }

    const baseSortMode = isRatingSort(requestedSort) ? lastNonRatingSortMode : requestedSort;
    const baseComparator = cmp[baseSortMode] || ((a, b) => a.idx - b.idx);
    visible.sort(baseComparator);

    if (isRatingSort(requestedSort)) {
      const orderMap = new Map();
      visible.forEach((item, index) => orderMap.set(item, index));
      visible.sort((a, b) => {
        let diff = ratingScore(b.tier) - ratingScore(a.tier);
        if (requestedSort === "rating-asc") diff = -diff;
        if (diff !== 0) return diff;
        return (orderMap.get(a) ?? 0) - (orderMap.get(b) ?? 0);
      });
    } else {
      lastNonRatingSortMode = requestedSort;
    }

    visible.forEach(m => listEl.appendChild(m.el));

    const n = visible.length;
    if (countEl) countEl.textContent = n ? `${n} ${n === 1 ? "tournament" : "tournaments"} found` : "No tournaments match your filters";
    if (noResEl) {
      noResEl.style.display = n === 0 ? "block" : "none";
      noResEl.classList.toggle("no-results--visible", n === 0);
    }

    if (clearEl && inputEl) clearEl.classList.toggle("visible", (inputEl.value || "").length > 0);
  }

  function run() {
    const { q, sort } = readParams();
    if (inputEl && q) inputEl.value = q;
    if (sortEl && sort) sortEl.value = sort;
    sizeSelectToLongest(sortEl);
    sizeInputToReference(inputEl);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        sizeSelectToLongest(sortEl);
        sizeInputToReference(inputEl);
      });
    }
    window.addEventListener('resize', () => {
      sizeSelectToLongest(sortEl);
      sizeInputToReference(inputEl);
    });

    inputEl && inputEl.addEventListener("input", deb(apply, 150));
    clearEl && inputEl && clearEl.addEventListener("click", () => {
      inputEl.value = "";
      inputEl.dispatchEvent(new Event("input", { bubbles: true }));
      inputEl.focus();
    });
    sortEl && sortEl.addEventListener("change", () => {
      apply();
      sizeSelectToLongest(sortEl);
      if (window.matchMedia('(max-width: 767px)').matches) {
        closeFilterPanel();
      }
    });
    clearAllBtn && inputEl && sortEl && clearAllBtn.addEventListener("click", () => {
      inputEl.value = "";
      sortEl.value = "date-asc";
      apply();
      sizeSelectToLongest(sortEl);
      sizeInputToReference(inputEl);
      inputEl.focus();
    });

    apply();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }
})();
