class CharacterData {
  data() {
    return {
      permalink: "/api/characters.json",
      eleventyExcludeFromCollections: true,
    };
  }
  render(data) {
    const characters = data.characterAnalytics;

    const output = {
      allCharacters: characters
    };

    return JSON.stringify(output);
  }
}

module.exports = CharacterData;

