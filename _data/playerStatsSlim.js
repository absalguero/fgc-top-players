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

/**
 * Builds a Map of normalized playerName -> previous archived rank
 * from the most recent snapshot date in 'Historical Data'.
 */
function buildPreviousRankMap(historicalRecords) {
  const prevRankMap = new Map();
  if (!Array.isArray(historicalRecords) || historicalRecords.length === 0) {
    return prevRankMap;
  }

  // Group records by YYYY-MM-DD snapshot date
  const byDate = new Map();
  historicalRecords.forEach(rec => {
    const rawDate = rec.Date || rec.date;
    const player = String(rec.Player || rec.player || '').trim();
    const rank = parseInt(rec.Rank ?? rec.rank, 10);
    if (!rawDate || !player || !Number.isFinite(rank) || rank <= 0) return;

    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return;
    const dateKey = d.toISOString().slice(0, 10);

    if (!byDate.has(dateKey)) byDate.set(dateKey, new Map());
    byDate.get(dateKey).set(player.toLowerCase(), rank);
  });

  const sortedDates = Array.from(byDate.keys()).sort((a, b) => b.localeCompare(a));
  if (sortedDates.length === 0) return prevRankMap;

  // Use the latest archived snapshot
  return byDate.get(sortedDates[0]) || prevRankMap;
}

module.exports = async function () {
  try {
    const getRankings = require("./rankings.js");
    const getHistoricalData = require("./historical.js");

    const [rankingsData, historicalData] = await Promise.all([
      getRankings(),
      getHistoricalData()
    ]);

    if (!rankingsData.players || rankingsData.players.length === 0) {
      return [];
    }

    const prevRankMap = buildPreviousRankMap(historicalData?.records || []);

    let allPlayers = rankingsData.players.map((p, idx) => {
      const playerName = getRowValue(p, "Player") || p.Player || '';
      const englishName = getRowValue(p, "English Name") || p['English Name'] || null;
      const slugSource = englishName || playerName;
      let playerSlug = createSafeSlug(slugSource);

      const parsedRank = parseSheetNumber(getRowValue(p, "Rank") ?? p.Rank);
      const rankNum = Number.isFinite(parsedRank) && parsedRank > 0 ? parsedRank : idx + 1;

      if (!playerSlug || playerSlug.trim() === '') {
        const playerId = getRowValue(p, "Player ID") || p['Player ID'] || '';
        playerSlug = playerId ? playerId : `player-${rankNum}`;
      }

      const delta6m = getSheet6MChange(p);
      const sheetRankChange = getRowValue(p, "Rank Change") ?? p['Rank Change'];

      // Calculate rank change from Historical Data if sheet doesn't have an explicit 'Rank Change' column
      const prevRank = prevRankMap.get(String(playerName).trim().toLowerCase()) ?? null;
      let computedRankChange = '—';

      if (sheetRankChange !== undefined && sheetRankChange !== null && String(sheetRankChange).trim() !== '') {
        computedRankChange = String(sheetRankChange).trim();
      } else if (prevRank !== null && Number.isFinite(rankNum)) {
        const diff = prevRank - rankNum; // Positive = moved up (e.g. from #5 to #3 is +2)
        computedRankChange = diff === 0 ? '—' : (diff > 0 ? `+${diff}` : `${diff}`);
      } else if (prevRankMap.size > 0 && rankNum <= 40) {
        computedRankChange = 'NEW';
      }

      const rawChar = getRowValue(p, "Main Character") || getRowValue(p, "Character") || p['Main Character'] || '';
      const rawCountry = getRowValue(p, "Country") || p.Country || '';

      return {
        name: playerName,
        englishName,
        rank: rankNum,
        previousRank: prevRank,
        slug: playerSlug,
        rankChange: computedRankChange,
        rankChange6m: delta6m !== null ? delta6m : '—',
        photoUrl: `/images/players/${playerSlug}.png`,
        country: rawCountry,
        countryCode: p.CountryCode ? p.CountryCode.toLowerCase() : null,
        mainCharacter: rawChar,
        game: "sf6"
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

    const slimPlayers = allPlayers
      .filter(player => player.rank && player.rank <= 200)
      .map(player => ({
        name: player.name,
        englishName: player.englishName,
        rank: player.rank,
        previousRank: player.previousRank,
        slug: player.slug,
        rankChange: player.rankChange,
        rankChange6m: player.rankChange6m,
        photoUrl: player.photoUrl,
        country: player.country,
        countryCode: player.countryCode,
        mainCharacter: player.mainCharacter
      }));

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