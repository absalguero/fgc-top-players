const EleventyFetch = require("@11ty/eleventy-fetch");
const slugify = require("slugify");
const fs = require("fs").promises;
const path = require("path");
const Papa = require("papaparse");
const { DateTime } = require("luxon");

function parseCSV(csvText) {
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: h => h.trim(),
    download: false, // Don't use browser download
    worker: false, // Don't use Web Workers (not available in Node.js)
  });
  if (result.errors.length) {
    console.warn("⚠️ CSV Parsing Errors:", result.errors);
  }
  return result.data;
}

const ARCHIVE_PATH = path.join(__dirname, "tournaments_archive.json");
const getFirstPresent = (row, keys) => {
  for (const k of keys) {
    if (row[k] != null && String(row[k]).trim() !== "") return String(row[k]).trim();
  }
  return null;
};
function parseDateToISO(value) {
  if (!value) return null;
  const native = new Date(value);
  if (!isNaN(native)) return DateTime.fromJSDate(native).toISODate();
  const candidates = [
    "yyyy-LL-dd",   
    "LL/dd/yyyy",   
    "L/d/yyyy",     
    "dd/LL/yyyy",   
    "d/L/yyyy",
    "MMM d, yyyy",  
    "MMMM d, yyyy"  
  ];

  for (const fmt of candidates) {
    const dt = DateTime.fromFormat(value, fmt, { zone: "utc" });
    if (dt.isValid) return dt.toISODate();
  }
  return null;
}

module.exports = async function () {
  try {
    console.log("Fetching and processing tournament data...");
    let archive = {};
    try {
      const fileContents = await fs.readFile(ARCHIVE_PATH, "utf8");
      archive = JSON.parse(fileContents);
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }

    const googleSheetURL =
      "https://docs.google.com/spreadsheets/d/1otrfs8HN3Shq6U2-qrc4GDxTI4ragnqwbTjweecE12Q/gviz/tq?tqx=out:csv&gid=332201631";

    try {
      const csvData = await EleventyFetch(googleSheetURL, {
        duration: "0",
        type: "text",
        fetchOptions: {
          timeout: 15000,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
          },
        },
      });

      const liveResults = parseCSV(csvData);
      const newEventsGrouped = {};
      liveResults.forEach((row) => {
        const eventName = getFirstPresent(row, [
          "Event",
          "Event Name",
          "Tournament",
          "Tournament Name",
          "Name",
        ]);
        if (!eventName) return;

        const rawDate = getFirstPresent(row, [
          "Date",
          "Date (UTC)",
          "Event Date",
          "Start Date",
          "Date (Local)",
        ]);
        const normalizedDate = parseDateToISO(rawDate);

        const slug = slugify(eventName, { lower: true, strict: true });

        if (!newEventsGrouped[slug]) {
          newEventsGrouped[slug] = {
            name: eventName,
            date: normalizedDate,
            slug,
            Tier: getFirstPresent(row, ["Tier", "Event Tier"]) || "",
            Entrants: getFirstPresent(row, ["Entrants", "Players", "Attendance"]) || "",
            results: [],
          };
        } else {
          if (!newEventsGrouped[slug].date && normalizedDate) {
            newEventsGrouped[slug].date = normalizedDate;
          }
        }

        newEventsGrouped[slug].results.push(row);
      });
      Object.values(newEventsGrouped).forEach((event) => {
        const now = DateTime.utc();
        const dt  = event.date ? DateTime.fromISO(event.date, { zone: "utc" }) : null;
        const isArchived =
          !!dt && dt.isValid && dt.toMillis() < now.minus({ years: 1 }).toMillis();
        event.isArchived = isArchived;
      });
      Object.values(newEventsGrouped).forEach((event) => {
        archive[event.slug] = event;
      });

      await fs.writeFile(ARCHIVE_PATH, JSON.stringify(archive, null, 2));
      console.log("✅ Successfully fetched and archived live data.");
    } catch (fetchError) {
      console.warn("⚠️ Could not fetch live tournament data, using local archive.", fetchError.message);
    }
    const toEpoch = (iso) => {
      if (!iso) return 0;
      const dt = DateTime.fromISO(iso);
      return dt.isValid ? dt.toMillis() : 0;
    };
    const eventsArray = Object.values(archive)
      .map((event) => {
        if (typeof event.isArchived === "undefined") {
          const now = DateTime.utc();
          const dt  = event.date ? DateTime.fromISO(event.date, { zone: "utc" }) : null;
          event.isArchived =
            !!dt && dt.isValid && dt.toMillis() < now.minus({ years: 1 }).toMillis();
        }
        return event;
      })
      .sort((a, b) => toEpoch(b.date) - toEpoch(a.date));

    return { events: eventsArray };
  } catch (err) {
    console.error("❌ A critical error occurred in tournaments.js:", err);
    return { events: [] };
  }
};
