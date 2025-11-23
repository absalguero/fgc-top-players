exports.data = {
  permalink: "/api/upcoming-rated.json",
  eleventyExcludeFromCollections: true,
  layout: null,
};

function normalizeTournaments(allUpcoming = {}) {
  return Object.values(allUpcoming || {});
}

function filterRated(tournaments = []) {
  return tournaments
    .filter((t) => {
      if (!t || typeof t !== "object") return false;
      if (t.isArchived) return false;
      if (t.excludeFromSite) return false;
      return Boolean(t.tier);
    });
}

exports.render = function render(data) {
  const source = normalizeTournaments(data.allUpcomingTournaments);
  const tournaments = filterRated(source);

  return JSON.stringify(
    {
      generatedAt: data.page?.date ? new Date(data.page.date).toISOString() : null,
      tournaments,
    },
    null,
    0
  );
};
