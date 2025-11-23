exports.data = {
  permalink: "/api/tournament-results.json",
  eleventyExcludeFromCollections: true,
  layout: null,
};

exports.render = function render(data) {
  const events = Array.isArray(data.tournaments?.events)
    ? data.tournaments.events
    : [];

  return JSON.stringify(
    {
      generatedAt: data.page?.date ? new Date(data.page.date).toISOString() : null,
      events,
    },
    null,
    0
  );
};
