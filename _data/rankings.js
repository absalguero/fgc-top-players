const EleventyFetch = require("@11ty/eleventy-fetch");
const fs = require("fs");
const path = require("path");
const Papa = require("papaparse");

const CACHE_PATH = path.join(__dirname, "rankings_cache.json");

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
        const dataURL = `https://docs.google.com/spreadsheets/d/1otrfs8HN3Shq6U2-qrc4GDxTI4ragnqwbTjweecE12Q/gviz/tq?tqx=out:csv&gid=1862929315&range=A:Z&cachebuster=${Date.now()}`;
        
        const csvText = await EleventyFetch(dataURL, {
            duration: "0s",
            type: "text",
            fetchOptions: {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
                }
            }
        });

        if (typeof csvText !== 'string' || !csvText) {
            throw new Error("Failed to fetch a valid CSV string from the Google Sheet.");
        }

        const parseResult = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header, index) => {
                const trimmed = header.trim();

                // Only map an empty header to "Rank" if it is actually the first column (Column A, index 0)
                if (trimmed === '') {
                    return index === 0 ? 'Rank' : `_empty_${index}`;
                }

                return trimmed;
            },
            download: false, // Don't use browser download
            worker: false, // Don't use Web Workers (not available in Node.js)
        });

        const players = parseResult.data
            .filter(p => p.Player && p.Player.trim() !== '')
            .map(p => {
                // Ensure positional fallbacks for Column F (index 5) and Column J/K (index 9/10)
                // in case gviz merged headers or date cells shifted the header string in Row 1
                const keys = Object.keys(p);
                if (p["Rating"] === undefined && keys[5]) {
                    p["Rating"] = p[keys[5]];
                }
                if (
                    p["Rating Change 6M"] === undefined &&
                    p["6M Rating Change"] === undefined
                ) {
                    // Check Column K (index 10) first, then Column J (index 9)
                    const colK = keys[10] ? p[keys[10]] : undefined;
                    const colJ = keys[9] ? p[keys[9]] : undefined;
                    if (colK !== undefined && String(colK).trim() !== "") {
                        p["Rating Change 6M"] = colK;
                    } else if (colJ !== undefined && String(colJ).trim() !== "") {
                        p["Rating Change 6M"] = colJ;
                    }
                }
                return p;
            });

        if (players.length === 0) throw new Error("No valid player data was found in the sheet.");
        
        let lastUpdated = new Date().toLocaleDateString();
        try {
            const dateURL = `https://docs.google.com/spreadsheets/d/1otrfs8HN3Shq6U2-qrc4GDxTI4ragnqwbTjweecE12Q/gviz/tq?tqx=out:csv&gid=1862929315&range=J1&cachebuster=${Date.now()}`;
            const dateText = await EleventyFetch(dateURL, { duration: "0s", type: "text" });
            lastUpdated = dateText.replace(/"/g, '').trim();
        } catch (error) {
            console.warn("Could not fetch Last Updated date from J1, using current date");
        }

        const freshData = { players, lastUpdated };
        writeToCache(freshData);
        console.log(`✅ Successfully fetched and filtered ${freshData.players.length} fresh player records.`);
        return freshData;

    } catch (error) {
        console.warn(`⚠️ Eleventy fetch for live rankings failed. Falling back to cached data.`);
        console.error("Fetch error details:", error.message);
        
        if (cachedData && cachedData.players) {
            console.log(`Using ${cachedData.players.length} players from cache file.`);
            cachedData.players = cachedData.players.filter(p => p.Player && p.Player.trim() !== '');
        }
        
        return cachedData;
    }
};