const EleventyFetch = require("@11ty/eleventy-fetch");
const fs = require("fs");
const path = require("path");
const Papa = require("papaparse");

const CACHE_DIR = path.join(__dirname, "..", ".cache");
const CACHE_PATH = path.join(CACHE_DIR, "historical_cache.json");

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
        const sheetURL = 'https://docs.google.com/spreadsheets/d/1otrfs8HN3Shq6U2-qrc4GDxTI4ragnqwbTjweecE12Q/gviz/tq?tqx=out:csv&gid=444793485';
        
        const csvText = await EleventyFetch(sheetURL, {
            duration: "0s",
            type: "text",
            fetchOptions: {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
                }
            }
        });

        if (typeof csvText !== 'string' || !csvText) {
            throw new Error("Failed to fetch a valid CSV string for historical data.");
        }

        const parseResult = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            transformHeader: header => header.trim(),
            download: false, // Don't use browser download
            worker: false, // Don't use Web Workers (not available in Node.js)
        });

        const historicalData = parseResult.data.filter(r => r.Player && r.Date && r.Rank);

        const freshData = { records: historicalData };
        writeToCache(freshData);
        console.log("✅ Successfully fetched and processed historical data.");
        return freshData;

    } catch (error) {
        console.warn(`⚠️ Eleventy fetch for historical data failed: ${error.message}. Falling back to cache.`);
        return cachedData;
    }
};
