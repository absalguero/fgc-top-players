// /js/popularityTracker.js

const createPopularityTracker = (type) => {
  if (!type || typeof type !== 'string') {
    console.error('Popularity tracker requires a valid type (e.g., "player", "character").');
    return null;
  }

  const STORAGE_KEYS = {
    PAGE_VIEWS: `fgc_${type}_page_views`,
    COMPARISONS: `fgc_${type}_comparison_selections`,
    SEARCHES: `fgc_${type}_searches`
  };

  const WEIGHTS = {
    PAGE_VIEW: 1.0,
    COMPARISON: 3.0,
    SEARCH: 0.5
  };

  const getStoredData = (key) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  };

  const saveData = (key, data) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch {
      /* noop */
    }
  };

  const getPopularityScore = (slug) => {
    if (!slug) return 0;
    const pageViews = getStoredData(STORAGE_KEYS.PAGE_VIEWS)[slug] || 0;
    const comparisons = getStoredData(STORAGE_KEYS.COMPARISONS)[slug] || 0;
    const searches = getStoredData(STORAGE_KEYS.SEARCHES)[slug] || 0;
    return (
      (pageViews * WEIGHTS.PAGE_VIEW) +
      (comparisons * WEIGHTS.COMPARISON) +
      (searches * WEIGHTS.SEARCH)
    );
  };

  const tracker = {
    type,

    trackPageView(slug) {
      if (!slug) return;
      const data = getStoredData(STORAGE_KEYS.PAGE_VIEWS);
      data[slug] = (data[slug] || 0) + 1;
      saveData(STORAGE_KEYS.PAGE_VIEWS, data);
    },

    trackComparison(slug) {
      if (!slug) return;
      const data = getStoredData(STORAGE_KEYS.COMPARISONS);
      data[slug] = (data[slug] || 0) + 1;
      saveData(STORAGE_KEYS.COMPARISONS, data);
    },

    trackSearch(slug) {
      if (!slug) return;
      const data = getStoredData(STORAGE_KEYS.SEARCHES);
      data[slug] = (data[slug] || 0) + 1;
      saveData(STORAGE_KEYS.SEARCHES, data);
    },

    getPopularityScore,

    getAllPopularityScores() {
      const pageViews = getStoredData(STORAGE_KEYS.PAGE_VIEWS);
      const comparisons = getStoredData(STORAGE_KEYS.COMPARISONS);
      const searches = getStoredData(STORAGE_KEYS.SEARCHES);

      const allSlugs = new Set([
        ...Object.keys(pageViews),
        ...Object.keys(comparisons),
        ...Object.keys(searches)
      ]);

      const scores = {};
      allSlugs.forEach(slug => {
        scores[slug] = getPopularityScore(slug);
      });
      return scores;
    },

    getTopPopularSlugs(n = 10) {
      const scores = this.getAllPopularityScores();
      return Object.entries(scores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([slug, score]) => ({ slug, score }));
    },

    getEngagementStats(slug) {
      if (!slug) return null;
      return {
        pageViews: getStoredData(STORAGE_KEYS.PAGE_VIEWS)[slug] || 0,
        comparisons: getStoredData(STORAGE_KEYS.COMPARISONS)[slug] || 0,
        searches: getStoredData(STORAGE_KEYS.SEARCHES)[slug] || 0,
        totalScore: getPopularityScore(slug)
      };
    },

    clearAllData() {
      Object.values(STORAGE_KEYS).forEach(key => {
        try { localStorage.removeItem(key); } catch { /* noop */ }
      });
    },

    exportData() {
      return {
        type: this.type,
        pageViews: getStoredData(STORAGE_KEYS.PAGE_VIEWS),
        comparisons: getStoredData(STORAGE_KEYS.COMPARISONS),
        searches: getStoredData(STORAGE_KEYS.SEARCHES),
        exportDate: new Date().toISOString()
      };
    }
  };

  return tracker;
};

// Optional: developer seeding helper (not auto-run)
function seedInitialPopularity(entities, trackerInstance) {
  if (!Array.isArray(entities) || !trackerInstance) return;
  entities.forEach(entity => {
    if (!entity || !entity.slug) return;
    
    // Player-specific seeding logic
    if (trackerInstance.type === 'player' && (!entity.rank || entity.rank > 40)) return;

    const rank = entity.rank || entity.cpvRank || 50; // Use rank, cpvRank, or a default
    const baseViews = Math.max(0, 100 - (rank * 2));
    const baseComparisons = Math.max(0, 50 - rank);

    for (let i = 0; i < baseViews; i++) trackerInstance.trackPageView(entity.slug);
    for (let i = 0; i < baseComparisons; i++) trackerInstance.trackComparison(entity.slug);
  });
}

if (typeof window !== 'undefined') {
  window.PlayerPopularity = createPopularityTracker('player');
  window.CharacterPopularity = createPopularityTracker('character');
  window.seedInitialPopularity = seedInitialPopularity; // call manually if desired
}
