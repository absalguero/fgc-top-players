exports.data = {
  permalink: "/api/sf6-rankings.json",
  eleventyExcludeFromCollections: true,
  layout: null,
};

exports.render = function render(data) {
  const players = Array.isArray(data.rankings?.players)
    ? data.rankings.players
    : [];
  const lastUpdated =
    data.rankings?.lastUpdated ||
    data.rankings?.updatedAt ||
    (data.page?.date ? new Date(data.page.date).toISOString() : null);

  return JSON.stringify(
    {
      lastUpdated,
      players,
    },
    null,
    0
  );
};
