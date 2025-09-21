// _data/historical.js
const EleventyFetch = require("@11ty/eleventy-fetch");
const fs = require("fs");
const path = require("path");

const CACHE_DIR = path.join(__dirname, "..", ".cache");
const CACHE_PATH = path.join(CACHE_DIR, "historical_cache.json");

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
      console.error("Error reading or parsing historical_cache.json:", error);
    }
  }
  return { records: [] };
};

const writeToCache = (data) => {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  fs.writeFileSync(CACHE_PATH, JSON.stringify(data, null, 2));
};

module.exports = async function() {
  const cachedData = readFromCache();

  try {
    // Ensure this GID matches your published historical sheet
    const sheetURL = 'https://docs.google.com/spreadsheets/d/1otrfs8HN3Shq6U2-qrc4GDxTI4ragnqwbTjweecE12Q/gviz/tq?tqx=out:csv&gid=444793485';
    
    // ✅ Using the same robust fetch options as rankings.js
    const csvText = await EleventyFetch(sheetURL, {
      duration: "0", // Always try to fetch fresh data
      type: "text",
      directory: ".cache",
      fetchOptions: {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
        }
      }
    });

    if (typeof csvText !== 'string' || !csvText) {
      throw new Error("Failed to fetch a valid CSV string for historical data.");
    }

    const rows = csvText.trim().split('\n');
    if (rows.length < 2) return { records: [] };
    
    const headers = parseCsvRow(rows[0]);
    const historicalData = rows.slice(1).map(rowStr => {
      const values = parseCsvRow(rowStr);
      const record = {};
      headers.forEach((header, i) => {
        record[header] = values[i] || '';
      });
      return record;
    }).filter(r => r.Player && r.Date && r.Rank); // Ensure rows have essential data

    const freshData = { records: historicalData };
    writeToCache(freshData);
    console.log("✅ Successfully fetched and processed historical data.");
    return freshData;

  } catch (error) {
    console.warn(`⚠️ Eleventy fetch for historical data failed: ${error.message}. Falling back to cache.`);
    return cachedData;
  }
};