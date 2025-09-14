// /_data/rankings.js
const EleventyFetch = require("@11ty/eleventy-fetch");
const fs = require("fs");
const path = require("path");

const CACHE_PATH = path.join(__dirname, "rankings_cache.json");

/**
 * Parses a single row from a CSV string, handling quoted values.
 * @param {string} rowString The CSV row to parse.
 * @returns {string[]} An array of cell values.
 */
function parseCsvRow(rowString) {
  if (!rowString) return [];
  const values = rowString.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
  return values.map(value => value.replace(/^"|"$/g, '').trim());
}

/**
 * Reads player ranking data from a local JSON cache file.
 * @returns {{lastUpdated: string, players: Array}} The cached data or a default object.
 */
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

/**
 * Writes player ranking data to the local JSON cache file.
 * @param {object} data The data to write to the cache.
 */
const writeToCache = (data) => {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(data, null, 2));
};

module.exports = async function() {
  const cachedData = readFromCache();

  try {
    const sheetURL = 'https://docs.google.com/spreadsheets/d/1otrfs8HN3Shq6U2-qrc4GDxTI4ragnqwbTjweecE12Q/gviz/tq?tqx=out:csv&gid=1862929315';
    
    // Fetch CSV data from Google Sheets, caching the result.
    const csvText = await EleventyFetch(sheetURL, {
      duration: "1d", // Cache the result for one day
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
    return freshData;

  } catch (error) {
    console.warn("⚠️  Eleventy fetch for rankings failed. Falling back to cached data.", error.message);
    return cachedData;
  }
};