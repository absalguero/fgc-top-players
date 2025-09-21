// /_data/playerProfiles.js
const slugify = require("slugify");
const getRankings = require("./rankings.js");
const getTournaments = require("./tournaments.js");
const getHistoricalData = require("./historical.js");

function createSafeSlug(name) {
  const s = name || '';
  const slug = slugify(s, {
    // This now includes the '#' to ensure it gets removed
    remove: /[#<>:"/\\|?*]/g,
    lower: true,    // Ensure slugs are always lowercase
    strict: true    // Remove any remaining invalid characters
  });
  return slug;
}

function getStandardDeviation(arr) {
  if (!arr || arr.length < 2) return 0;
  const n = arr.length;
  const mean = arr.reduce((a, b) => a + b) / n;
  const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
  return Math.sqrt(variance);
}

function getTierName(tier) {
  if (!tier) return 'Event';
  if (tier.startsWith('S')) return 'Major';
  if (tier === 'A') return 'National';
  if (tier === 'B') return 'Regional';
  return 'Event';
}

function getCharacterFileName(character) {
  if (!character) return '';
  return character
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove all special characters except whitespace
    .replace(/\s+/g, '-');      // Replace one or more whitespace characters with a hyphen
}

module.exports = async function() {
  console.log("Processing player profile data...");

  const rankingsData = await getRankings();
  const tournamentsData = await getTournaments();
  const historicalData = await getHistoricalData();
  const tournaments = tournamentsData.events || [];

  if (!rankingsData.players || rankingsData.players.length === 0) {
    return [];
  }

  let allPlayers = rankingsData.players.map(p => {
    const notableWins = [];
    if (p['Notable Win 1'] && p['Notable Win 1'].trim() !== '') notableWins.push(p['Notable Win 1']);
    if (p['Notable Win 2'] && p['Notable Win 2'].trim() !== '') notableWins.push(p['Notable Win 2']);
    if (p['Notable Win 3'] && p['Notable Win 3'].trim() !== '') notableWins.push(p['Notable Win 3']);

    return {
      name: p.Player,
      rank: parseInt(p.Rank, 10),
      slug: createSafeSlug(p.Player),
      photoUrl: p['Player Icon'],
      country: p.Country,
      countryCode: p.CountryCode ? p.CountryCode.toLowerCase() : null,
      mainCharacter: p['Main Character'],
      earnings: p.Earnings,
      socials: { twitter: p.Twitter, twitch: p.Twitch },
      pronouns: p.Pronouns,
      notableWins: notableWins,
      results: [],
      historicalData: [],
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
          tournament: event.name,
          date: new Date(event.date),
          placement: parseInt(result.Finish, 10),
          entrants: parseInt(event['Entrants'], 10) || 0,
          tier: event.Tier || null,
          icon: parseInt(result.Finish, 10) === 1 ? '<i class="fas fa-trophy trophy-1"></i>' :
            parseInt(result.Finish, 10) === 2 ? '<i class="fas fa-trophy trophy-2"></i>' :
            parseInt(result.Finish, 10) === 3 ? '<i class="fas fa-trophy trophy-3"></i>' :
            parseInt(result.Finish, 10) === 4 ? '<i class="fas fa-medal medal-4"></i>' : '',
        });
      }
    });
  });

  historicalData.records.forEach(record => {
    const player = allPlayers.find(p => p.name === record.Player);
    if (player) {
      player.historicalData.push({
        date: new Date(record.Date),
        rank: parseInt(record.Rank, 10)
      });
    }
  });

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const tierOrder = { 'S+': 3, 'S': 2, 'A': 1, 'B': 0 };

  for (const player of allPlayers) {
    player.results.sort((a, b) => b.date - a.date);
    player.historicalData.sort((a, b) => b.date - a.date);
    
    player.characterFileName = getCharacterFileName(player.mainCharacter);
    
    const results1yr = player.results.filter(r => r.date >= oneYearAgo);
    player.results_1yr = results1yr;

    player.stats_1yr = {};
    player.trophies_1yr = {};
    player.signaturePerformance_1yr = null;
    player.stats_recent = {};

    if (results1yr.length > 0) {
      player.trophies_1yr.victories = results1yr.filter(r => r.placement === 1).length;
      player.trophies_1yr.top3 = results1yr.filter(r => r.placement <= 3).length;
      player.trophies_1yr.top8 = results1yr.filter(r => r.placement <= 8).length;
      player.trophies_1yr.top16 = results1yr.filter(r => r.placement <= 16).length;

      const placements1yr = results1yr.map(r => r.placement);
      player.stats_1yr.avgFinish = placements1yr.reduce((a, b) => a + b, 0) / placements1yr.length;
      const consistencyScore = getStandardDeviation(placements1yr);
      player.stats_1yr.consistencyScore = consistencyScore === 0 ? 'N/A' : consistencyScore.toFixed(1);
      
      const resultsWithEntrants = results1yr.filter(r => r.entrants > 1);
      const majorsWithEntrants = resultsWithEntrants.filter(r => r.tier === 'S+' || r.tier === 'S');
      
      const allPercentiles = resultsWithEntrants.map(r => ((r.entrants - r.placement) / (r.entrants - 1)) * 100);
      const majorPercentiles = majorsWithEntrants.map(r => ((r.entrants - r.placement) / (r.entrants - 1)) * 100);
      
      player.stats_1yr.avgPercentile = allPercentiles.length > 0 ? allPercentiles.reduce((a, b) => a + b, 0) / allPercentiles.length : 0;
      player.stats_1yr.avgPercentileMajors = majorPercentiles.length > 0 ? majorPercentiles.reduce((a, b) => a + b, 0) / majorPercentiles.length : 0;
      
      let bestPerformance = null;
      if (resultsWithEntrants.length > 0) {
        bestPerformance = [...resultsWithEntrants].sort((a, b) => {
          if (a.placement !== b.placement) return a.placement - b.placement;
          const tierA = tierOrder[a.tier] ?? -1;
          const tierB = tierOrder[b.tier] ?? -1;
          if (tierA !== tierB) return tierB - tierA;
          if (a.entrants !== b.entrants) return b.entrants - a.entrants;
          return b.date - a.date;
        })[0];
      }

      if (bestPerformance) {
        player.signaturePerformance_1yr = {
          tournamentName: bestPerformance.tournament,
          placementIcon: bestPerformance.icon || `#${bestPerformance.placement}`,
          entrants: bestPerformance.entrants,
          tier: bestPerformance.tier,
          tierName: getTierName(bestPerformance.tier)
        };
      }
    }

    const majors1yr = results1yr.filter(r => r.tier === 'S+' || r.tier === 'S');
    if (majors1yr.length > 0) {
      const avgFinishMajors = majors1yr.reduce((sum, current) => sum + current.placement, 0) / majors1yr.length;
      player.stats_1yr.avgFinishMajors = avgFinishMajors.toFixed(1);
    } else {
      player.stats_1yr.avgFinishMajors = 'N/A';
    }
    
    const rankedHistory = player.historicalData.filter(h => h.rank && h.rank > 0);
    if (rankedHistory.length > 0) {
      const ranks = rankedHistory.map(h => h.rank);
      player.stats_1yr.peakRank = Math.min(...ranks);
      const avgRank = ranks.reduce((sum, current) => sum + current, 0) / ranks.length;
      player.stats_1yr.avgRank = avgRank.toFixed(1);
    } else {
      player.stats_1yr.peakRank = 'N/A';
      player.stats_1yr.avgRank = 'N/A';
    }

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const recentResults = player.results.filter(r => r.date >= sixMonthsAgo);
    
    if (recentResults.length > 0) {
      const avgFinishRecent = recentResults.reduce((sum, current) => sum + current.placement, 0) / recentResults.length;
      player.stats_recent.avgFinish = avgFinishRecent.toFixed(1);
    } else {
      player.stats_recent.avgFinish = 'N/A';
    }

    const startDate = new Date('2025-09-01T00:00:00Z');
    let weeksInTop40 = 0;
    player.historicalData.forEach(entry => {
      if (new Date(entry.date) >= startDate && entry.rank <= 40) {
        weeksInTop40++;
      }
    });
    player.stats_recent.weeksInTop40 = weeksInTop40;
  }

  const MIN_TOURNAMENTS = 5;
  const eligiblePlayers = allPlayers.filter(p => p.results_1yr && p.results_1yr.length >= MIN_TOURNAMENTS);
  allPlayers.forEach(p => p.leaderRank = {});
  
  const getNestedValue = (obj, path) => path.split('.').reduce((o, i) => (o ? o[i] : undefined), obj);

  const statsToProcess = [
    { key: 'victories', path: 'trophies_1yr.victories', order: 'desc' },
    { key: 'top3', path: 'trophies_1yr.top3', order: 'desc' },
    { key: 'top8', path: 'trophies_1yr.top8', order: 'desc' },
    { key: 'top16', path: 'trophies_1yr.top16', order: 'desc' },
    { key: 'avgPercentile', path: 'stats_1yr.avgPercentile', order: 'desc' },
    { key: 'avgPercentileMajors', path: 'stats_1yr.avgPercentileMajors', order: 'desc' },
    { key: 'weeksInTop40', path: 'stats_recent.weeksInTop40', order: 'desc' },
    { key: 'avgFinish', path: 'stats_1yr.avgFinish', order: 'asc'  },
    { key: 'avgFinishRecent', path: 'stats_recent.avgFinish', order: 'asc'  },
    { key: 'avgFinishMajors', path: 'stats_1yr.avgFinishMajors', order: 'asc'  },
    { key: 'consistencyScore', path: 'stats_1yr.consistencyScore', order: 'asc'  }
  ];

  statsToProcess.forEach(stat => {
    const qualifiedPlayers = eligiblePlayers.filter(p => {
      const value = getNestedValue(p, stat.path);
      return value !== 'N/A' && value !== null && value !== undefined;
    });

    const sortedPlayers = [...qualifiedPlayers].sort((a, b) => {
      const valA = getNestedValue(a, stat.path) || 0;
      const valB = getNestedValue(b, stat.path) || 0;
      return stat.order === 'desc' ? valB - valA : valA - valB;
    });

    const top5Players = sortedPlayers.slice(0, 5);
    top5Players.forEach((leader, index) => {
      const originalPlayer = allPlayers.find(p => p.name === leader.name);
      if (originalPlayer) {
        originalPlayer.leaderRank[stat.key] = index + 1;
      }
    });
  });

  allPlayers.sort((a, b) => (a.rank || Infinity) - (b.rank || Infinity));
  allPlayers.forEach((player, index, arr) => {
    player.previousPlayer = index > 0 ? { name: arr[index - 1].name, slug: arr[index - 1].slug, rank: arr[index - 1].rank } : null;
    player.nextPlayer = index < arr.length - 1 ? { name: arr[index + 1].name, slug: arr[index + 1].slug, rank: arr[index + 1].rank } : null;
  });

  return allPlayers;
};