// /_data/tournaments.js
const EleventyFetch = require("@11ty/eleventy-fetch");
const slugify = require("slugify");
const fs = require("fs").promises; // ✨ Use the modern, promise-based version of fs
const path = require("path");
const Papa = require("papaparse"); // ✨ NEW: Using a robust CSV parsing library
const { DateTime } = require("luxon");

/**
 * ♻️ REFACTOR: Replaced manual parser with the industry-standard papaparse library.
 * This is more reliable and handles edge cases like commas in quotes.
 * @param {string} csvText The raw CSV text.
 * @returns {Array<Object>} An array of objects representing the rows.
 */
function parseCSV(csvText) {
  const result = Papa.parse(csvText, {
    header: true, // Automatically uses the first row as headers
    skipEmptyLines: true,
    transformHeader: header => header.trim(), // Cleans up header names
  });

  if (result.errors.length) {
    console.warn("⚠️ CSV Parsing Errors:", result.errors);
  }
  
  return result.data;
}

const ARCHIVE_PATH = path.join(__dirname, "tournaments_archive.json");

module.exports = async function() {
  try {
    console.log("Fetching and processing tournament data...");
    let archive = {};

    // 1. Read the existing archive file from disk (asynchronously).
    try {
      const fileContents = await fs.readFile(ARCHIVE_PATH, 'utf8');
      archive = JSON.parse(fileContents);
    } catch (error) {
      // If the file doesn't exist, it's fine; we'll create it later.
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    const googleSheetURL = "https://docs.google.com/spreadsheets/d/1otrfs8HN3Shq6U2-qrc4GDxTI4ragnqwbTjweecE12Q/gviz/tq?tqx=out:csv&gid=332201631";

    try {
      // 2. Fetch the latest results from the Google Sheet.
      const csvData = await EleventyFetch(googleSheetURL, {
        duration: "0",
        type: "text",
        fetchOptions: {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
          }
        }
      });
      
      const liveResults = parseCSV(csvData);

      // 3. Group the flat results list by event name.
      const newEventsGrouped = {};
      liveResults.forEach(row => {
  const eventName = row.Event;
  if (!eventName || !row.Date) return;

  // ✅ Normalize the date safely
  let normalizedDate = null;
  try {
    const parsed = new Date(row.Date);
    if (!isNaN(parsed)) {
      normalizedDate = DateTime.fromJSDate(parsed).toISODate(); // YYYY-MM-DD
    }
  } catch (err) {
    console.warn(`⚠️ Could not parse date for event "${eventName}":`, row.Date);
  }

  if (!newEventsGrouped[eventName]) {
    newEventsGrouped[eventName] = {
      name: eventName,
      date: normalizedDate, // always ISO format
      slug: slugify(eventName, { lower: true, strict: true }),
      Tier: row.Tier,
      Entrants: row.Entrants,
      results: []
    };
  }
  newEventsGrouped[eventName].results.push(row);
});
      
      // 4. Merge the new data into the archive and write it back to disk (asynchronously).
      Object.values(newEventsGrouped).forEach(event => {
        archive[event.slug] = event;
      });

      await fs.writeFile(ARCHIVE_PATH, JSON.stringify(archive, null, 2));
      console.log("✅ Successfully fetched and archived live data.");

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