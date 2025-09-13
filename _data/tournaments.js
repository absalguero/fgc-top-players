// _data/tournaments.js
const EleventyFetch = require("@11ty/eleventy-fetch");
const slugify = require("slugify");
const fs = require("fs");
const path = require("path");
const { DateTime } = require("luxon");

function parseCSV(text) {
    if (typeof text !== 'string' || !text) return [];

    const rows = text.trim().split('\n');
    if (rows.length <= 1) return [];
    const headers = rows[0].split(',').map(h => h.trim().replace(/"/g, ''));
    return rows.slice(1).map(rowStr => {
        const values = rowStr.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
        const rowData = {};
        headers.forEach((header, i) => {
            rowData[header] = values[i] ? values[i].replace(/^"|"$/g, '').trim() : '';
        });
        return rowData;
    }).filter(row => row.Player && row.Player.trim() !== '');
}

const ARCHIVE_PATH = path.join(__dirname, "tournaments_archive.json");

module.exports = async function() {
    try {
        console.log("Fetching and archiving tournament data...");
        let archive = {};
        if (fs.existsSync(ARCHIVE_PATH)) {
            const fileContents = fs.readFileSync(ARCHIVE_PATH, 'utf8');
            if (fileContents) {
                archive = JSON.parse(fileContents);
            }
        }
        const googleSheetURL = "https://docs.google.com/spreadsheets/d/1otrfs8HN3Shq6U2-qrc4GDxTI4ragnqwbTjweecE12Q/gviz/tq?tqx=out:csv&gid=1021048964";
        try {
            const csvData = await EleventyFetch(googleSheetURL, {
                duration: "1d",
                type: "text",
                fetchOptions: {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
                    }
                }
            });
            
            // --- ✅ FINAL FIX: Convert the Buffer to a String ---
            const csvString = csvData.toString();
            const liveResults = parseCSV(csvString);
            // ----------------------------------------------------

            const newEventsGrouped = {};
            liveResults.forEach(row => {
                const eventName = row.Event;
                if (!eventName) return;

                if (!newEventsGrouped[eventName]) {
                    const eventDate = DateTime.fromFormat(row.Date, "yyyy-MM-dd").toJSDate();

                    newEventsGrouped[eventName] = {
                        name: eventName,
                        date: eventDate,
                        slug: slugify(eventName, { lower: true, strict: true }),
                        results: []
                    };
                }
                newEventsGrouped[eventName].results.push(row);
            });
            Object.values(newEventsGrouped).forEach(event => {
                archive[event.slug] = event;
            });
            fs.writeFileSync(ARCHIVE_PATH, JSON.stringify(archive, null, 2));
            console.log("Successfully fetched and archived live data.");
        } catch (fetchError) {
            console.warn("⚠️ Could not fetch live tournament data, using local archive.", fetchError.message);
        }
        const eventsArray = Object.values(archive).sort((a, b) => new Date(b.date) - new Date(a.date));
        return {
            events: eventsArray
        };
    } catch (error) {
        console.error("❌ A critical error occurred in tournaments.js:", error);
        return {
            events: []
        };
    }
};