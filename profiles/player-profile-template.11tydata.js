module.exports = {
  eleventyComputed: {
    permalink: (data) => {
      const player = data.player || {};
      const results = Array.isArray(player.results_1yr) ? player.results_1yr : [];
      const slug = player.slug;
      const rank = player.rank;

      if (!slug) return false;

      // Check if player appears in any character's notable players
      const characterAnalytics = data.characterAnalytics || [];
      const isNotablePlayer = characterAnalytics.some((char) => {
        if (!Array.isArray(char.notablePlayers)) return false;
        return char.notablePlayers.some((p) => p.slug === slug);
      });

      if ((typeof rank === "number" && rank > 0 && rank <= 200) || results.length >= 3 || isNotablePlayer) {
        return `/players/${slug}/`;
      }

      return false;
    },
  },
};
