class PlayerStatsSlimJSON {
  data() {
    return {
      permalink: '/data/player-stats-slim.json',
      eleventyExcludeFromCollections: true,
    };
  }

  render(data) {
    const payload = {
      generatedAt: new Date().toISOString(),
      players: data.playerStatsSlim || [],
    };

    return JSON.stringify(payload);
  }
}

module.exports = PlayerStatsSlimJSON;
