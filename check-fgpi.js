const data = require('./_site/api/player-profiles.json');

const noFGPI = data.filter(p => {
  if (!p.rank || p.rank > 200) return false;
  if (!p.stats || !p.stats.FGPI || p.stats.FGPI === null) return true;
  return false;
});

console.log('Players ranked 1-200 without FGPI:', noFGPI.length);

if (noFGPI.length > 0) {
  console.log('\nExamples:');
  noFGPI.slice(0, 10).forEach(p => {
    const results = (p.results_1yr || []).length;
    console.log(`  Rank ${p.rank} - ${p.name} - Results: ${results}`);
  });
}

const withFGPI = data.filter(p => p.rank && p.rank <= 200 && p.stats && p.stats.FGPI);
console.log('\nPlayers ranked 1-200 with FGPI:', withFGPI.length);
