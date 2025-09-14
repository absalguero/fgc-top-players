// /_data/tournaments.js
const EleventyFetch = require("@11ty/eleventy-fetch");
const slugify = require("slugify");
const fs = require("fs");
const path = require("path");
const { DateTime } = require("luxon");

/**
 * Parses a CSV string into an array of objects.
 * @param {string} text The raw CSV text.
 * @returns {Array<Object>} An array of objects representing the rows.
 */
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
    console.log("Fetching and processing tournament data...");
    let archive = {};

    // 1. Read the existing archive file from disk.
    if (fs.existsSync(ARCHIVE_PATH)) {
      const fileContents = fs.readFileSync(ARCHIVE_PATH, 'utf8');
      if (fileContents) {
        archive = JSON.parse(fileContents);
      }
    }

    const googleSheetURL = "https://docs.google.com/spreadsheets/d/1otrfs8HN3Shq6U2-qrc4GDxTI4ragnqwbTjweecE12Q/gviz/tq?tqx=out:csv&gid=332201631";

    try {
      // 2. Fetch the latest results from the Google Sheet.
      const csvData = await EleventyFetch(googleSheetURL, {
        duration: "1d",
        type: "text",
        fetchOptions: {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
          }
        }
      });
      
      const liveResults = parseCSV(csvData.toString());

      // 3. Group the flat results list by event name.
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
            Tier: row.Tier,
            results: []
          };
        }
        newEventsGrouped[eventName].results.push(row);
      });
      
      // 4. Merge the new data into the archive and write it back to disk.
      Object.values(newEventsGrouped).forEach(event => {
        archive[event.slug] = event;
      });

      fs.writeFileSync(ARCHIVE_PATH, JSON.stringify(archive, null, 2));
      console.log("Successfully fetched and archived live data.");

    } catch (fetchError) {
      console.warn("⚠️ Could not fetch live tournament data, using local archive.", fetchError.message);
    }

    // 5. Return all events, sorted with the newest first.
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