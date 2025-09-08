const fs = require("fs");
const path = require("path");
const slugify = require("slugify");

module.exports = function(eleventyConfig) {
  // Pass through the images, css, and js folders to the output directory
  eleventyConfig.addPassthroughCopy("images");
  eleventyConfig.addPassthroughCopy("css");
  eleventyConfig.addPassthroughCopy("styles.css");
  eleventyConfig.addPassthroughCopy("js");

  eleventyConfig.watchIgnores.add("_data/tournaments_archive.json");
  eleventyConfig.watchIgnores.add("_data/rankings_cache.json");

  // Shortcode for the current year
  eleventyConfig.addShortcode("year", () => `${new Date().getFullYear()}`);

  // A filter to format dates into a human-readable string
  eleventyConfig.addFilter("readableDate", dateObj => {
  if (!dateObj || isNaN(new Date(dateObj))) {
    return "Invalid Date";
  }
  return new Date(dateObj).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC"
  });
});

// Slugify filter
eleventyConfig.addFilter("slugify", function(str) {
  return slugify(str, {
    lower: true,
    strict: true,
    remove: /[*+~.()'"!:@]/g
  });
});

// Find filter
eleventyConfig.addFilter("find", function(arr, key, value) {
  if (!Array.isArray(arr)) {
    return undefined;
  }
  return arr.find(item => item[key] === value);
});


  // A MORE ROBUST filter to sort tournament results by "Finish" place
  eleventyConfig.addFilter("sortByFinish", results => {
    // 1. Check if 'results' is a valid array. If not, return an empty one.
    if (!Array.isArray(results)) {
        return [];
    }
    
    // 2. Create a mutable copy to avoid modifying the original array
    return [...results].sort((a, b) => {
        // 3. Safely get the 'Finish' value, defaulting to a large number if missing
        const finishA = a ? String(a.Finish || '9999') : '9999';
        const finishB = b ? String(b.Finish || '9999') : '9999';

        const numA = parseInt(finishA.replace(/(st|nd|rd|th)/, ''));
        const numB = parseInt(finishB.replace(/(st|nd|rd|th)/, ''));

        // Handle cases where parsing might fail
        if (isNaN(numA)) return 1;
        if (isNaN(numB)) return -1;

        return numA - numB;
    });
  });

  // A shortcode to inject a small block of CSS for the archive page
  eleventyConfig.addShortcode("css", function() {
    return `<style>.intro-text{text-align:center;font-size:1.1rem;color:#ccc;}.archive-list{margin-top:2rem;display:grid;gap:0.5rem;}.archive-item{display:flex;justify-content:space-between;align-items:center;padding:1rem;background-color:#1a1a1a;border-radius:6px;text-decoration:none;transition:background-color 0.2s;}.archive-item:hover{background-color:#2a2a2a;text-decoration:none;}.archive-item__name{font-weight:bold;color:#f0f0f0;}.archive-item__date{color:#999;font-size:0.9rem;}.h2-subtle{font-size:1.5rem;color:#999;text-align:center;margin-top:-0.5rem;margin-bottom:1.5rem;}</style>`;
  });

  return {
    dir: {
      input: ".",
      includes: "_includes",
      data: "_data",
      output: "_site"
    }
  };
};