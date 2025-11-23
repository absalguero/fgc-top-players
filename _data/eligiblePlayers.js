const getPlayerProfiles = require("./playerProfiles.js");

const MIN_RESULTS = 3;
const TOP_RANK_LIMIT = 200;

function toNumber(value) {
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function qualifies(player) {
  if (!player) return false;
  const results = Array.isArray(player.results_1yr)
    ? player.results_1yr.length
    : 0;
  const rank = toNumber(player.rank);
  const isTop200 = rank !== null && rank > 0 && rank <= TOP_RANK_LIMIT;
  return results >= MIN_RESULTS || isTop200;
}

module.exports = async function () {
  const profiles = await getPlayerProfiles();

  const eligible = profiles
    .filter((player) => player?.slug)
    .filter(qualifies)
    .sort((a, b) => {
      const rankA = toNumber(a.rank) ?? Infinity;
      const rankB = toNumber(b.rank) ?? Infinity;
      if (rankA !== rankB) return rankA - rankB;
      return (a.name || "").localeCompare(b.name || "");
    });

  return eligible;
};
