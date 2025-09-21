// .eleventy.js
const fs = require("fs");
const path = require("path");
const slugify = require("slugify");
const { DateTime } = require("luxon");

module.exports = function(eleventyConfig) {
  // --- Environment Handling ---
  const isProduction = process.env.ELEVENTY_ENV === 'production';
  if (isProduction) {
    eleventyConfig.ignores.add("admin.njk");
  }

  // --- Passthrough Copies ---
  eleventyConfig.addPassthroughCopy("images");
  eleventyConfig.addPassthroughCopy("css");
  eleventyConfig.addPassthroughCopy("js");

  // --- Watch Ignores ---
  eleventyConfig.watchIgnores.add(".env");
  eleventyConfig.watchIgnores.add("_data/tournaments_archive.json");
  eleventyConfig.watchIgnores.add("_data/rankings_cache.json");

  // --- Shortcodes ---
  eleventyConfig.addShortcode("year", () => `${new Date().getFullYear()}`);

  // --- Filters ---
  eleventyConfig.addFilter("readableDate", (dateInput) => {
    if (!dateInput) return "";
    let dt;

    if (typeof dateInput === "string") {
      dt = DateTime.fromISO(dateInput, { zone: "utc" });
    } else if (dateInput instanceof Date) {
      dt = DateTime.fromJSDate(dateInput, { zone: "utc" });
    } else {
      return "";
    }

    return dt.isValid ? dt.toFormat("MMMM d, yyyy") : "";
  });

  eleventyConfig.addFilter("date", (dateInput, format = "LLL d, yyyy") => {
    if (!dateInput) return "";
    let dt;

    if (typeof dateInput === "string") {
      dt = DateTime.fromISO(dateInput, { zone: "utc" });
    } else if (dateInput instanceof Date) {
      dt = DateTime.fromJSDate(dateInput, { zone: "utc" });
    } else {
      return "";
    }

    return dt.isValid ? dt.toFormat(format) : "";
  });

  eleventyConfig.addFilter("limit", (arr, limit) => arr.slice(0, limit));

  eleventyConfig.addFilter("slugify", (str) => {
    if (!str) return "";
    return slugify(str, { lower: true, strict: true, remove: /[*+~.()'"!:@]/g });
  });

  eleventyConfig.addFilter("url_encode", (str) => {
    if (!str) return "";
    return encodeURIComponent(str);
  });

  eleventyConfig.addFilter("nl2p", (str) => {
    if (!str) return "";
    const paragraphs = str.trim().split(/\n\s*\n/);
    return paragraphs.map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
  });
  
  eleventyConfig.addFilter("split", (str, separator) => {
    if (typeof str !== 'string') return [];
    return str.split(separator);
  });

  eleventyConfig.addFilter("find", (arr, key, value) => {
    if (!arr) return;
    return arr.find(item => item[key] === value);
  });

  eleventyConfig.addFilter("sortByFinish", (results) => {
    if (!results) return [];
    return [...results].sort((a, b) => parseInt(a.Finish, 10) - parseInt(b.Finish, 10));
  });

  eleventyConfig.addFilter("values", (obj) => Object.values(obj));
  
  eleventyConfig.addNunjucksFilter("jsonify", function(data) {
    return JSON.stringify(data, null, 2);
  });
  
  eleventyConfig.addNunjucksFilter("ordinal", (n) => {
    if (typeof n !== 'number') return n;
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  });

  // --- Eleventy Directory Configuration ---
  return {
    dir: {
      input: ".",
      includes: "_includes",
      data: "_data",
      output: "_site"
    }
  };
};
