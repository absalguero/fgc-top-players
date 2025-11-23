// api/player-profiles.json.11ty.js
class PlayerProfilesAPI {
  data() {
    return {
      permalink: "/api/player-profiles.json",
      eleventyExcludeFromCollections: true,
    };
  }

  render(data) {
    const allPlayers = data.playerProfiles || [];

    // Only return players in the top 200
    const eligiblePlayers = allPlayers.filter(player => {
      return player.rank && player.rank <= 200;
    });

    return JSON.stringify(eligiblePlayers);
  }
}

module.exports = PlayerProfilesAPI;