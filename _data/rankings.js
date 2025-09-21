const EleventyFetch = require("@11ty/eleventy-fetch");
const fs = require("fs");
const path = require("path");

const CACHE_PATH = path.join(__dirname, "rankings_cache.json");

function parseCsvRow(rowString) {
  if (!rowString) return [];
  const values = rowString.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
  return values.map(value => value.replace(/^"|"$/g, '').trim());
}

const readFromCache = () => {
  if (fs.existsSync(CACHE_PATH)) {
    try {
      const fileContents = fs.readFileSync(CACHE_PATH, 'utf8');
      if (fileContents) return JSON.parse(fileContents);
    } catch (error) {
      console.error("Error reading or parsing rankings_cache.json:", error);
    }
  }
  return { lastUpdated: "N/A", players: [] };
};

const writeToCache = (data) => {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(data, null, 2));
};

module.exports = async function() {
  const cachedData = readFromCache();

  try {
    const sheetURL = 'https://docs.google.com/spreadsheets/d/1otrfs8HN3Shq6U2-qrc4GDxTI4ragnqwbTjweecE12Q/gviz/tq?tqx=out:csv&gid=1862929315';
    
    const csvText = await EleventyFetch(sheetURL, {
      duration: "0",
      type: "text",
      directory: ".cache",
      fetchOptions: {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
        }
      }
    });

    if (typeof csvText !== 'string' || !csvText) {
      throw new Error("Failed to fetch a valid CSV string from the Google Sheet.");
    }

    const rows = csvText.trim().split('\n');
    if (rows.length < 2) throw new Error("CSV has no data rows.");
    
    const headers = parseCsvRow(rows[0]);
    const players = rows.slice(1).map(rowStr => {
      const values = parseCsvRow(rowStr);
      const player = {};
      headers.forEach((header, i) => {
        player[header] = values[i] || '';
      });
      return player;
    }).filter(p => p.Player && p.Player.trim() !== '');

    if (players.length === 0) throw new Error("No valid player data was found in the sheet.");
    
    const lastUpdated = players[0]['Last Updated'] || "N/A";

    const freshData = { players, lastUpdated };
    writeToCache(freshData);
    console.log("✅ Successfully fetched and filtered fresh rankings data.");
    return freshData;

  } catch (error) {
    console.warn(`⚠️ Eleventy fetch for rankings failed: ${error.message}. Falling back to cached data.`);
    
    // ✅ SAFETY NET: Filter the cached data as a fallback.
    if (cachedData && cachedData.players) {
        console.log("Attempting to filter cached data as a fallback...");
        cachedData.players = cachedData.players.filter(p => p.Player && p.Player.trim() !== '');
    }
    
    return cachedData;
  }
};