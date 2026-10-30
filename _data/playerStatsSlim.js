const slugify = require("slugify");

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

const normKey = (k) => String(k || '').normalize("NFKC").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

function getRowValue(row, field) {
  if (!row) return null;
  if (Object.prototype.hasOwnProperty.call(row, field)) return row[field];
  const target = normKey(field);
  for (const k of Object.keys(row)) if (normKey(k) === target) return row[k];
  return null;
}

function parseSheetNumber(val) {
  if (val === null || val === undefined) return NaN;
  const cleaned = String(val)
    .replace(/[\u2212\u2013\u2014]/g, "-")
    .replace(/[,\s+]/g, "")
    .trim();
  if (cleaned === "" || cleaned === "-" || /^n\/?a$/i.test(cleaned)) return NaN;
  return Number(cleaned);
}

function getSheet6MChange(row) {
  const fields = ["Rating Change 6M", "6M Rating Change", "6M Rank Change", "Rank Change 6M", "6M Change", "6M"];
  for (const f of fields) {
    const v = getRowValue(row, f);
    const num = parseSheetNumber(v);
    if (Number.isFinite(num)) return num;
  }
  return null;
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

    let allPlayers = rankingsData.players.map((p) => {
      const slugSource = p['English Name'] || p.Player;
      let playerSlug = createSafeSlug(slugSource);
      const rankNum = parseInt(p.Rank, 10);

      if (!playerSlug || playerSlug.trim() === '') {
        const playerId = p['Player ID'] || '';
        playerSlug = playerId ? playerId : `player-${rankNum}`;
      }

      const delta6m = getSheet6MChange(p);

      return {
        name: p.Player,
        englishName: p['English Name'] || null,
        rank: rankNum,
        slug: playerSlug,
        rankChange: p['Rank Change'] || '—',
        rankChange6m: delta6m !== null ? delta6m : '—',
        photoUrl: `/images/players/${playerSlug}.png`,
        country: p.Country,
        countryCode: p.CountryCode ? p.CountryCode.toLowerCase() : null,
        mainCharacter: p['Main Character'],
        game: "sf6",
        results: [],
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
      if (event.results && Array.isArray(event.results)) {
        event.results.forEach(result => {
          const player = allPlayers.find(p => p.name === result.Player);
          if (player) {
            player.results.push({
              date: new Date(event.date),
            });
          }
        });
      }
    });

    const slimPlayers = allPlayers.map(player => {
      if (player.rank && player.rank <= 200) {
        return {
          name: player.name,
          englishName: player.englishName,
          rank: player.rank,
          slug: player.slug,
          rankChange: player.rankChange,
          rankChange6m: player.rankChange6m,
          photoUrl: player.photoUrl,
          country: player.country,
          countryCode: player.countryCode,
          mainCharacter: player.mainCharacter,
        };
      }
      return null;
    }).filter(Boolean);

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