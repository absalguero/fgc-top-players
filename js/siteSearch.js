const SITE_SEARCH_INPUT_IDS = ["mobile-search-input", "sidebar-search-input"];
const MIN_QUERY_LENGTH = 2;

const panelEl = document.getElementById("site-search-panel");
const closeBtn = document.getElementById("site-search-close");
const statusEl = document.getElementById("site-search-status");
const pagefindContainer = document.getElementById("pagefind-search");
const refineForm = document.getElementById("site-search-refine");
const refineInput = document.getElementById("site-search-refine-input");
const clearBtn = document.getElementById("site-search-clear-btn");
const navInputs = SITE_SEARCH_INPUT_IDS.map((id) => document.getElementById(id)).filter(Boolean);

const BODY_LOCK_CLASS = "site-search-open";
const PANEL_OPEN_CLASS = "is-open";
const PANEL_HIDE_DELAY = 220;
const PAGEFIND_BUNDLE_URL = new URL("../pagefind/pagefind-ui.js", import.meta.url).href;

const DISMISS_KEY = "siteSearch:dismissed";
const markDismissed = () => sessionStorage.setItem(DISMISS_KEY, "1");
const clearDismissed = () => sessionStorage.removeItem(DISMISS_KEY);
const isDismissed = () => sessionStorage.getItem(DISMISS_KEY) === "1";

const debounce = (fn, wait = 200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), wait); }; };
const getFocusable = (root) => Array.from(root.querySelectorAll('a[href],button,input,textarea,select,summary,details,[tabindex]:not([tabindex="-1"])')).filter(el => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true');
let releaseFocusTrap = () => {};
const trapFocus = (container) => {
  const f = getFocusable(container);
  if (!f.length) return () => {};
  let first = f[0], last = f[f.length - 1];
  const onKeydown = (e) => {
    if (e.key !== 'Tab') return;
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  container.addEventListener('keydown', onKeydown);
  return () => container.removeEventListener('keydown', onKeydown);
};

// --- (3) cache results root to avoid repeated queries ---
const resultsRootSelector = ".pagefind-ui__results";
let resultsRootEl = null;
function getResultsRoot() {
  if (resultsRootEl && document.contains(resultsRootEl)) return resultsRootEl;
  resultsRootEl = panelEl?.querySelector(resultsRootSelector) || pagefindContainer;
  return resultsRootEl;
}

// --- (4) narrower, cheaper waitForResults ---
const waitForResults = (root, { timeout = 1200 } = {}) => new Promise((resolve) => {
  const target = root || getResultsRoot();
  const has = () => !!(target && target.querySelector(".pagefind-ui__result"));
  if (has()) return resolve(true);
  const obs = new MutationObserver((ml) => {
    if (ml.some(m => m.type === "childList" && m.addedNodes.length)) {
      if (has()) { obs.disconnect(); clearTimeout(t); resolve(true); }
    }
  });
  if (target) obs.observe(target, { childList: true });
  const t = setTimeout(() => { obs.disconnect(); resolve(has()); }, timeout);
});

const computePageSize = () => {
  const isMobile = window.matchMedia("(max-width: 767px)").matches;
  const vh = Math.max(480, window.innerHeight || 800);
  const approxItemH = 72;
  const base = Math.ceil((vh / approxItemH) * 1.6);
  return Math.min(Math.max(base, isMobile ? 8 : 10), isMobile ? 10 : 15);
};

export const getResultScrollers = () => {
  const scrollers = [
    panelEl,
    panelEl?.querySelector(".site-search-panel__results"),
    panelEl?.querySelector(".profile-card__body"),
    panelEl?.querySelector(".pagefind-ui__results"),
    panelEl?.querySelector(".pagefind-ui__drawer"),
    pagefindContainer
  ].filter(Boolean);
  return Array.from(new Set(scrollers));
};

// --- (1) coalesced scroll-to-top in a single rAF ---
let scrollTopRAF = 0;
function forceScrollTop() {
  if (scrollTopRAF) return;
  scrollTopRAF = requestAnimationFrame(() => {
    for (const el of getResultScrollers()) el.scrollTop = 0;
    scrollTopRAF = 0;
  });
}

(function injectStyles() {
  if (!panelEl) return;
  const id = "site-search-js-styles";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
  #site-search-panel.is-loading .pagefind-ui__message::after{content:" …";animation:siteSearchPulseDots 1s infinite steps(4,end)}
  @keyframes siteSearchPulseDots{0%{content:""}25%{content:" ."}50%{content:" .."}75%{content:" ..."}}
  .pagefind-ui__result.is-active{outline:2px solid var(--color-accent-blue,#09f);outline-offset:2px;border-radius:6px}
  .ss-hidden{display:none!important}
  .ss-load-more{display:block;margin:1rem auto;padding:.6rem 1rem;border:1px solid var(--color-border,#444);background:var(--color-bg-card-gradient-start,#2a2a2a);color:var(--color-text-primary,#fff);border-radius:8px;cursor:pointer}
  .ss-load-more:hover{filter:brightness(1.05)}
  .ss-sentinel{height:1px}
  `;
  document.head.appendChild(style);
})();

const LOW_MEMORY = true;
const IDLE_DESTROY_MS = 20000;
const MAX_RESULT_NODES = 120;

if (panelEl && closeBtn && pagefindContainer) {
  let activeInput = null;
  let pagefindUIInstance = null;
  let pagefindUILoadPromise = null;
  let lastQuery = "";
  let panelHideTimer = 0;
  let activeIdx = -1;
  let pagingCleanup = null;

  let idleDestroyTimer = 0;
  let activeSearchAbort = null;

  const toggleClearButton = () => { 
    if (clearBtn && refineInput) {
      clearBtn.classList.toggle("visible", refineInput.value.length > 0);
    }
  };

  function cancelActiveSearch() {
    try { activeSearchAbort?.abort?.(); } catch {}
    activeSearchAbort = null;
  }

  function hardDestroyPagefindUI() {
    cancelActiveSearch();
    try {
      const resultsRoot = getResultsRoot();
      if (resultsRoot) resultsRoot.replaceChildren();
      if (pagefindContainer) pagefindContainer.replaceChildren();
      if (typeof pagingCleanup === "function") { try { pagingCleanup(); } catch {} }
      pagingCleanup = null;
      const s = document.querySelector("script[data-pagefind-ui]");
      if (s) s.remove();
      if (window.pagefindUIInstance) delete window.pagefindUIInstance;
      pagefindUIInstance = null;
      pagefindUILoadPromise = null;
      resultsRootEl = null;
    } catch {}
  }

  function scheduleIdleDestroy() {
    if (!LOW_MEMORY) return;
    clearTimeout(idleDestroyTimer);
    idleDestroyTimer = window.setTimeout(() => {
      if (!panelEl.classList.contains(PANEL_OPEN_CLASS)) hardDestroyPagefindUI();
    }, IDLE_DESTROY_MS);
  }

  async function ensureLowMemoryPagefind() {
    if (!LOW_MEMORY) return ensurePagefindUI();
    if (!pagefindUIInstance) await ensurePagefindUI();
    return pagefindUIInstance;
  }

  function capResultNodes() {
    try {
      const list = getResultsRoot();
      if (!list) return;
      const nodes = Array.from(list.querySelectorAll(".pagefind-ui__result"));
      if (nodes.length <= MAX_RESULT_NODES) return;
      for (let i = MAX_RESULT_NODES; i < nodes.length; i++) nodes[i].remove();
    } catch {}
  }

  panelEl.setAttribute("role", "dialog");
  panelEl.setAttribute("aria-modal", "true");
  panelEl.inert = true; // start inert while hidden
  if (statusEl) {
    statusEl.setAttribute("role", "status");
    statusEl.setAttribute("aria-live", "polite");
    statusEl.setAttribute("aria-atomic", "true");
  }

  const lockBodyScroll = () => document.body.classList.add(BODY_LOCK_CLASS);
  const unlockBodyScroll = () => document.body.classList.remove(BODY_LOCK_CLASS);

  // --- (7) set inert false when showing; true when hiding ---
  const showPanel = () => {
    if (!panelEl.classList.contains(PANEL_OPEN_CLASS)) {
      clearTimeout(panelHideTimer);
      panelEl.hidden = false;
      panelEl.setAttribute("aria-hidden", "false");
      panelEl.inert = false;
      requestAnimationFrame(() => {
        panelEl.classList.add(PANEL_OPEN_CLASS);
        lockBodyScroll();
        releaseFocusTrap = trapFocus(panelEl);
        clearDismissed();
        (refineInput || panelEl).focus({ preventScroll: true });
        forceScrollTop();
      });
    } else {
      forceScrollTop();
    }
  };

  const hidePanel = ({ returnFocus = true, force = false, resetQuery = false, clearQuery = false } = {}) => {
    if (!panelEl.classList.contains(PANEL_OPEN_CLASS) && !force) return;
    panelEl.classList.remove(PANEL_OPEN_CLASS);
    unlockBodyScroll();
    hideStatus();
    releaseFocusTrap?.();
    releaseFocusTrap = () => {};
    activeIdx = -1;
    if (typeof pagingCleanup === "function") { try { pagingCleanup(); } catch {} pagingCleanup = null; }
    forceScrollTop();
    clearTimeout(panelHideTimer);
    panelHideTimer = window.setTimeout(() => {
      panelEl.hidden = true;
      panelEl.setAttribute("aria-hidden", "true");
      panelEl.inert = true;
    }, PANEL_HIDE_DELAY);
    scheduleIdleDestroy();
    if (LOW_MEMORY) hardDestroyPagefindUI();
    markDismissed();

    if (resetQuery) {
      lastQuery = "";
      updateRefineControls("");
      syncNavInputs("");
      setPagefindInputValue("");
      hideStatus();
    }
    if (resetQuery || clearQuery) {
      const url = new URL(location.href);
      url.searchParams.delete("sq");
      history.replaceState({}, "", url);
    }
    if (returnFocus && activeInput) activeInput.focus();
  };

  const showStatus = (message, { isError = false } = {}) => {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.hidden = false;
    statusEl.classList.add("is-visible");
    statusEl.classList.toggle("is-error", isError);
  };

  const hideStatus = () => {
    if (!statusEl) return;
    statusEl.textContent = "";
    statusEl.hidden = true;
    statusEl.classList.remove("is-visible", "is-error");
  };

  const syncNavInputs = (value) => { navInputs.forEach((input) => { if (input) input.value = value; }); };

  const setPagefindInputValue = (value) => {
    const pagefindInput = panelEl.querySelector(".pagefind-ui__search-input");
    if (pagefindInput) {
      pagefindInput.value = value;
      pagefindInput.setAttribute("value", value);
    }
  };

  const updateRefineControls = (value, { focus = false, select = false } = {}) => {
    if (refineInput) {
      refineInput.value = value;
      refineInput.setAttribute("value", value);
      if (focus && document.activeElement !== refineInput) {
        refineInput.focus({ preventScroll: true });
      }
      if (select && document.activeElement !== refineInput) {
        refineInput.select();
      }
    }
    setPagefindInputValue(value);
    toggleClearButton();
  };

  const loadPagefindConstructor = async () => {
    if (window.PagefindUI) return window.PagefindUI;
    if (!pagefindUILoadPromise) {
      pagefindUILoadPromise = new Promise((resolve, reject) => {
        const existingScript = document.querySelector("script[data-pagefind-ui]");
        const handleResolve = () => resolve(window.PagefindUI || null);
        if (existingScript) {
          if (window.PagefindUI) { resolve(window.PagefindUI); return; }
          existingScript.addEventListener("load", handleResolve, { once: true });
          existingScript.addEventListener("error", () => reject(new Error(`Failed to load ${PAGEFIND_BUNDLE_URL}`)), { once: true });
          return;
        }
        const script = document.createElement("script");
        const bust = (window.location && /^https?:\/\/(localhost|127\.0\.0\.1)/.test(window.location.origin))
          ? `${PAGEFIND_BUNDLE_URL}${PAGEFIND_BUNDLE_URL.includes("?") ? "&" : "?"}v=${Date.now()}`
          : PAGEFIND_BUNDLE_URL;
        script.src = bust;
        script.async = false;
        script.dataset.pagefindUi = "true";
        script.addEventListener("load", () => requestAnimationFrame(() => resolve(window.PagefindUI || null)), { once: true });
        script.addEventListener("error", () => reject(new Error(`Failed to load ${PAGEFIND_BUNDLE_URL}`)), { once: true });
        document.head.appendChild(script);
      }).finally(() => { pagefindUILoadPromise = null; });
    }
    return pagefindUILoadPromise;
  };

  const ensurePagefindUI = async () => {
    if (pagefindUIInstance) return pagefindUIInstance;
    try {
      const PagefindConstructor = await loadPagefindConstructor();
      if (!PagefindConstructor) throw new Error("Pagefind UI constructor is unavailable.");
      pagefindUIInstance = new PagefindConstructor({
        element: "#pagefind-search",
        bundlePath: "/pagefind/",
        resetStyles: false,
        showImages: false,
        showSubResults: false,
        pageSize: computePageSize(),
        translations: {
          search_label: "Search the site",
          search_placeholder: "Search the site...",
          clear_search: "Clear search",
          zero_results: "No results for \"[SEARCH_TERM]\"",
          many_results: "[COUNT] results for \"[SEARCH_TERM]\"",
          one_result: "[COUNT] result for \"[SEARCH_TERM]\"",
        },
      });
      window.pagefindUIInstance = pagefindUIInstance;
      hideStatus();
      return pagefindUIInstance;
    } catch (error) {
      const errorMessage = typeof error?.message === "string" ? error.message : "";
      const message = /Failed to load|Search assets are missing/i.test(errorMessage)
        ? "Search assets are missing. Run `npm run pagefind` after your Eleventy build and refresh."
        : "Search index is not ready yet. Run `npm run pagefind` after your Eleventy build.";
      showStatus(message, { isError: true });
      return null;
    }
  };

  // --- (2) only scrollIntoView when not fully visible ---
  function isFullyInView(el, root) {
    const host = (root || el.parentElement);
    if (!el || !host) return true;
    const r = el.getBoundingClientRect();
    const hr = host.getBoundingClientRect();
    return r.top >= hr.top && r.bottom <= hr.bottom;
  }

  const highlightItemAt = (idx) => {
    const list = getResultsRoot();
    // --- FIXED LINE BELOW ---
    const items = list ? Array.from(list.querySelectorAll(".pagefind-ui__result")) : [];
    items.forEach(el => el.classList.remove("is-active"));
    if (!items.length || idx < 0 || idx >= items.length) return null;
    const el = items[idx];
    el.classList.add("is-active");
    if (!isFullyInView(el, list)) el.scrollIntoView({ block: "nearest" });
    return el;
  };

  // --- (5) batch hide/reveal for paging to minimize reflows ---
  function batchToggle(items, start, end, hidden) {
    const doHide = hidden === true;
    for (let i = start; i < end; i++) {
      const c = items[i].classList;
      doHide ? c.add("ss-hidden") : c.remove("ss-hidden");
    }
  }

  const enhancePaging = () => {
    const list = getResultsRoot();
    if (!list) return () => {};
    const items = Array.from(list.querySelectorAll(".pagefind-ui__result"));
    if (!items.length) return () => {};

    const firstH = Math.max(1, items[0].getBoundingClientRect().height || 72);
    const vh = Math.max(480, window.innerHeight || 800);
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    const base = Math.ceil((vh / firstH) * 1.6);
    const page = Math.min(Math.max(base, isMobile ? 6 : 8), isMobile ? 10 : 15);

    list.querySelectorAll(".ss-load-more, .ss-sentinel").forEach(n => n.remove());
    items.forEach(el => el.classList.remove("ss-hidden"));

    let shown = 0;
    batchToggle(items, 0, items.length, true);

    const reveal = (count) => {
      const end = Math.min(shown + count, items.length);
      batchToggle(items, shown, end, false);
      shown = end;
      if (shown >= items.length) teardown();
      updateButton();
      capResultNodes();
    };

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ss-load-more";
    btn.textContent = "Load more results";
    btn.addEventListener("click", () => reveal(page), { passive: true });

    const sentinel = document.createElement("div");
    sentinel.className = "ss-sentinel";

    let io = null;
    const setupInfinite = () => {
      if (isMobile) return;
      io = new IntersectionObserver((entries) => {
        if (entries.some(e => e.isIntersecting)) reveal(page);
      }, { root: list, rootMargin: "200px 0px", threshold: 0 });
      io.observe(sentinel);
    };
    const updateButton = () => {
      if (isMobile && shown < items.length && !btn.isConnected) list.appendChild(btn);
      if (isMobile && shown >= items.length && btn.isConnected) btn.remove();
    };
    const teardown = () => {
      try { io?.disconnect(); } catch {}
      sentinel.remove();
      btn.remove();
      window.removeEventListener("resize", onResize);
    };
    const onResize = debounce(() => {
      const nowMobile = window.matchMedia("(max-width: 767px)").matches;
      if (nowMobile !== isMobile) { teardown(); enhancePaging(); }
    }, 200);

    forceScrollTop();
    reveal(page);
    if (!isMobile) { list.appendChild(sentinel); setupInfinite(); }
    window.addEventListener("resize", onResize);

    return teardown;
  };

  const runSearch = async (rawQuery, inputEl, { source = "nav" } = {}) => {
    const query = (rawQuery || "").trim();
    activeInput = inputEl || null;

    if (!query || query.length < MIN_QUERY_LENGTH) {
      lastQuery = "";
      updateRefineControls(query, { focus: true });
      syncNavInputs(query);
      showPanel();
      showStatus(`Enter at least ${MIN_QUERY_LENGTH} characters to search.`, { isError: true });
      return;
    }

    showPanel();
    forceScrollTop();

    const url = new URL(location.href);
    url.searchParams.set("sq", query); 
    history.replaceState({}, "", url);

    if (query === lastQuery) {
      const resultsRoot = getResultsRoot();
      const hasResults = resultsRoot && (resultsRoot.querySelector(".pagefind-ui__result") || resultsRoot.querySelector(".pagefind-ui__message"));

      if (hasResults) {
        const shouldSelect = (source === "nav" || source === "initial");
        updateRefineControls(query, { focus: true, select: shouldSelect });
        syncNavInputs(query);
        hideStatus();
        forceScrollTop();
        return;
      }
    }

    lastQuery = query;
    activeIdx = -1;
    if (typeof pagingCleanup === "function") { try { pagingCleanup(); } catch {} pagingCleanup = null; }

    cancelActiveSearch();
    activeSearchAbort = new AbortController();
    const { signal } = activeSearchAbort;

    showStatus("Searching...");
    const ui = await ensureLowMemoryPagefind();
    if (!ui) return;

    const shouldSelect = (source === "nav" || source === "initial");
    updateRefineControls(query, { focus: true, select: shouldSelect });
    syncNavInputs(query);

    panelEl.classList.add("is-loading");
    try {
      if (signal.aborted) return;
      await ui.triggerSearch(query);
      if (signal.aborted) return;

      const resultsRoot = getResultsRoot();
      const hadResults = await waitForResults(resultsRoot, { timeout: 1200 });
      if (signal.aborted) return;

      hideStatus();
      forceScrollTop();
      if (!hadResults) {
        showStatus(`No results for “${query}”. Try shorter terms, fewer filters, or a different keyword.`, { isError: false });
      } else {
        capResultNodes();
        forceScrollTop();
      }
    } catch (error) {
      if (!signal.aborted) showStatus("Something went wrong while searching. Please try again.", { isError: true });
    } finally {
      panelEl.classList.remove("is-loading");
    }
  };

  const wireInput = (inputId) => {
    const inputEl = document.getElementById(inputId);
    if (!inputEl) return;

    const formEl = inputEl.closest("form");
    if (formEl) {
      formEl.addEventListener("submit", (event) => {
        event.preventDefault();
        runSearch(inputEl.value, inputEl, { source: "nav" });
      });
    }

    inputEl.addEventListener("focus", () => {
      ensureLowMemoryPagefind();
      if (lastQuery.length >= MIN_QUERY_LENGTH && panelEl.classList.contains(PANEL_OPEN_CLASS)) showPanel();
    }, { passive: true });

    inputEl.addEventListener("keydown", (event) => {
      if (event.key === "Escape") hidePanel({ resetQuery: true, clearQuery: true });
      if (event.key === "Enter" && formEl) {
        event.preventDefault();
        formEl.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      }
    });
  };

  SITE_SEARCH_INPUT_IDS.forEach(wireInput);

  if (refineForm && refineInput) {
    const debouncedSearch = debounce(() => runSearch(refineInput.value, refineInput, { source: "refine" }), 220);

    // --- (6) input guard: IME composition & de-dup trimmed values ---
    let lastRefineValue = "";
    const onRefineInput = () => {
      const v = refineInput.value;
      if (refineInput.isComposing) return;
      const trimmed = v.trim();
      if (trimmed === lastRefineValue) return;
      lastRefineValue = trimmed;
      updateRefineControls(v);
      if (trimmed.length >= MIN_QUERY_LENGTH) debouncedSearch();
    };

    refineForm.addEventListener("submit", (event) => {
      event.preventDefault();
      runSearch(refineInput.value, refineInput, { source: "refine" });
    });

    refineInput.addEventListener("compositionstart", () => { /* block until compositionend */ }, { passive: true });
    refineInput.addEventListener("compositionend", () => {
      // trigger one pass after IME completes
      onRefineInput();
    }, { passive: true });

    refineInput.addEventListener("focus", () => ensureLowMemoryPagefind(), { passive: true });
    refineInput.addEventListener("input", onRefineInput);

    refineInput.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { event.preventDefault(); hidePanel({ clearQuery: true }); }
    });

    if (clearBtn) { 
      clearBtn.addEventListener("click", () => {
        if (!refineInput) return;
        updateRefineControls("", { focus: true });
        syncNavInputs("");
        lastQuery = "";
        try { pagefindUIInstance?.clearResults?.(); } catch {}
        showStatus(`Enter at least ${MIN_QUERY_LENGTH} characters to search.`, { isError: true });
      }, { passive: true });
    }
  }

  closeBtn.addEventListener("click", () => hidePanel({ returnFocus: false, clearQuery: true }), { passive: true });

  panelEl.addEventListener("click", (event) => {
    if (event.target === panelEl) hidePanel({ returnFocus: false, clearQuery: true });
  }, { passive: true });

  document.addEventListener("keydown", (e) => {
    const metaK = (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey));
    const slash = (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey);
    const activeTag = document.activeElement?.tagName?.toLowerCase();
    const typing = ["input","textarea","select"].includes(activeTag) || document.activeElement?.isContentEditable;

    if (metaK) {
      e.preventDefault();
      if (panelEl.classList.contains(PANEL_OPEN_CLASS)) hidePanel({ clearQuery: true });
      else { showPanel(); ensureLowMemoryPagefind(); }
      return;
    }
    if (slash && !typing) {
      e.preventDefault();
      (navInputs[0] || refineInput || panelEl).focus({ preventScroll: true });
      ensureLowMemoryPagefind();
      return;
    }
    if (e.key === "Escape" && panelEl.classList.contains(PANEL_OPEN_CLASS)) {
      e.preventDefault();
      hidePanel({ clearQuery: true });
      return;
    }
    if (!panelEl.classList.contains(PANEL_OPEN_CLASS)) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const items = getResultsRoot()?.querySelectorAll(".pagefind-ui__result");
      if (!items || !items.length) return;
      activeIdx = (activeIdx + 1) % items.length;
      highlightItemAt(activeIdx);
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const items = getResultsRoot()?.querySelectorAll(".pagefind-ui__result");
      if (!items || !items.length) return;
      activeIdx = (activeIdx - 1 + items.length) % items.length;
      highlightItemAt(activeIdx);
    }
    if (e.key === "Enter" && activeIdx >= 0) {
      const link = getResultsRoot()?.querySelectorAll(".pagefind-ui__result a")[activeIdx];
      if (link) link.click();
    }
  });

  const preloadPagefind = () => { ensureLowMemoryPagefind(); hideStatus(); };
  navInputs.forEach(inp => inp?.addEventListener("focus", preloadPagefind, { passive: true }));
  if (refineInput) refineInput.addEventListener("focus", preloadPagefind, { passive: true });

  try {
    const params = new URLSearchParams(location.search);
    const initialQ = params.get("sq");
    if (initialQ && initialQ.trim().length >= MIN_QUERY_LENGTH && !isDismissed()) {
      syncNavInputs(initialQ);
      updateRefineControls(initialQ);
      showPanel();
      ensureLowMemoryPagefind().then(() => runSearch(initialQ, refineInput, { source: "initial" }));
    }
  } catch {}
}