const fs = require("fs");
const path = require("path");
const slugify = require("slugify");
const { DateTime } = require("luxon");

module.exports = function(eleventyConfig) {
  const isProduction = process.env.ELEVENTY_ENV === 'production';
  if (isProduction) {
    eleventyConfig.ignores.add("admin.njk");
  }

  eleventyConfig.addPassthroughCopy("images");
  eleventyConfig.addPassthroughCopy("css");
  eleventyConfig.addPassthroughCopy("js");

  eleventyConfig.watchIgnores.add(".env");
  eleventyConfig.watchIgnores.add("_data/tournaments_archive.json");
  eleventyConfig.watchIgnores.add("_data/rankings_cache.json");

  eleventyConfig.addShortcode("year", () => `${new Date().getFullYear()}`);

  eleventyConfig.addFilter("readableDate", (dateObj) => {
    const dt = DateTime.fromJSDate(dateObj);
    if (dt.isValid) {
      return dt.toFormat("MMMM d, yyyy");
    }
    return "";
  });

  eleventyConfig.addFilter("slugify", (str) => {
    if (!str) return "";
    return slugify(str, { lower: true, strict: true, remove: /[*+~.()'"!:@]/g });
  });

  // Change from "urlencode" to "url_encode" to match the template.
  eleventyConfig.addFilter("url_encode", (str) => {
    if (!str) return "";
    return encodeURIComponent(str);
  });

  // ADD THIS NEW FILTER
  eleventyConfig.addFilter("nl2p", (str) => {
    if (!str) return "";
    // Split the string by one or more empty lines to create paragraphs
    const paragraphs = str.trim().split(/\n\s*\n/);
    // Wrap each block in a <p> tag and convert single newlines to <br> tags
    return paragraphs.map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
  });

  eleventyConfig.addFilter("find", (arr, key, value) => {
    if (!arr) return;
    return arr.find(item => item[key] === value);
  });

  eleventyConfig.addFilter("sortByFinish", (results) => {
    if (!results) return [];
    return [...results].sort((a, b) => {
      const finishA = parseInt(a.Finish, 10);
      const finishB = parseInt(b.Finish, 10);
      return finishA - finishB;
    });
  });

  eleventyConfig.addFilter("values", (obj) => Object.values(obj));

  return {
    dir: {
      input: ".",
      includes: "_includes",
      data: "_data",
      output: "_site"
    }
  };
};