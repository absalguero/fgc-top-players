class PlayerData {
  data() {
    return {
      permalink: "/api/players.json",
      eleventyExcludeFromCollections: true,
    };
  }
  render(data) {
    // Use collections.players instead of playerProfiles to only include players with actual profile pages
    const playersArray = data.collections?.players || [];
    const output = {
      allPlayers: playersArray
    };

    return JSON.stringify(output);
  }
}

module.exports = PlayerData;
