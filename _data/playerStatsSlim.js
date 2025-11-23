const slugify = require("slugify");
const { DateTime } = require("luxon");

function createSafeSlug(name) {
  const s = String(name || '')
    .replace(/[\p{Emoji_Presentation}]/gu, '')
    .replace(/[\p{Extended_Pictographic}]/gu, '')
    .replace(/\uFE0F/g, '')
    .replace(/[()]/g, '')
    .trim();

  return slugify(s, {
    lower: true,
    strict: false,
    locale: 'en',
    remove: /[*+~.()'"!:@]/g
  });
}

module.exports = async function () {
  try {
    const getRankings = require("./rankings.js");
    const getTournaments = require("./tournaments.js");

    const rankingsData = await getRankings();
    const tournamentsData = await getTournaments();
    const tournaments = tournamentsData.events || [];

    if (!rankingsData.players || rankingsData.players.length === 0) {
      return [];
    }

    let allPlayers = rankingsData.players.map(p => {
      const slugSource = p['English Name'] || p.Player;
      let playerSlug = createSafeSlug(slugSource);

      if (!playerSlug || playerSlug.trim() === '') {
        const rankNum = parseInt(p.Rank, 10);
        const playerId = p['Player ID'] || '';
        playerSlug = playerId ? playerId : `player-${rankNum}`;
      }

      return {
        name: p.Player,
        englishName: p['English Name'] || null,
        rank: parseInt(p.Rank, 10),
        slug: playerSlug,
        rankChange: p['Rank Change'] || '—',
        photoUrl: `/images/players/${playerSlug}.png`,
        country: p.Country,
        countryCode: p.CountryCode ? p.CountryCode.toLowerCase() : null,
        mainCharacter: p['Main Character'],
        game: "sf6",
        results: [], // Keep this for initial qualification check
      };
    });

    const slugCounts = {};
    allPlayers.forEach(player => {
      const originalSlug = player.slug;
      let count = slugCounts[originalSlug];
      if (count) {
        count++;
        slugCounts[originalSlug] = count;
        player.slug = `${originalSlug}-${count}`;
      } else {
        slugCounts[originalSlug] = 1;
      }
    });

    tournaments.forEach(event => {
        event.results.forEach(result => {
            const player = allPlayers.find(p => p.name === result.Player);
            if (player) {
                player.results.push({
                    date: new Date(event.date),
                });
            }
        });
    });

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const MIN_TOURNAMENTS_FOR_QUALIFICATION = 4;

    const slimPlayers = allPlayers.map(player => {
        // Only return players in the top 200
        if (player.rank && player.rank <= 200) {
            return {
                name: player.name,
                englishName: player.englishName,
                rank: player.rank,
                slug: player.slug,
                rankChange: player.rankChange,
                photoUrl: player.photoUrl,
                country: player.country,
                countryCode: player.countryCode,
                mainCharacter: player.mainCharacter,
            };
        }
        return null;
    }).filter(Boolean); // Filter out null values

    const normalizedRank = (value) => {
        const num = parseInt(value, 10);
        return Number.isFinite(num) ? num : Number.MAX_SAFE_INTEGER;
    };

    slimPlayers.sort((a, b) => normalizedRank(a.rank) - normalizedRank(b.rank));

    return slimPlayers;

  } catch (error) {
    console.error("❌ ERROR processing slim player stats:", error);
    return [];
  }
};
