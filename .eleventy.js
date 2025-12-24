// .eleventy.js
require('dotenv').config();
const { DateTime } = require("luxon");
const slugify = require("slugify");
const eleventySitemap = require("@quasibit/eleventy-plugin-sitemap");
const eleventyNavigationPlugin = require("@11ty/eleventy-navigation");
const filters = require("./_eleventy/filters.js");
const { TAG_SKIP } = require("./_eleventy/tagConfig");

function buildTagsBySlug(collectionApi) {
  const map = new Map();

  collectionApi.getAll().forEach((item) => {
    const tags = item.data.tags || [];
    tags.forEach((raw) => {
      if (typeof raw !== "string") return;
      const label = raw.trim();
      if (!label || TAG_SKIP.has(label.toLowerCase())) return;

      const slug = slugify(label, { lower: true, strict: true });
      if (!map.has(slug)) map.set(slug, { slug, label, items: [] });
      map.get(slug).items.push(item);
    });
  });

  const arr = Array.from(map.values()).map((entry) => ({
    ...entry,
    items: entry.items.sort((a, b) => (b.date || 0) - (a.date || 0)),
  }));
  return arr.sort((a, b) => a.slug.localeCompare(b.slug));
}

module.exports = async function (eleventyConfig) {
  const { default: eleventyPostcss } = await import("eleventy-plugin-postcss");

  eleventyConfig.addPlugin(eleventyNavigationPlugin, { createStubs: false });
  eleventyConfig.addPlugin(eleventySitemap, {
    sitemap: { hostname: "https://fgctopplayers.com" },
  });
  eleventyConfig.addPlugin(eleventyPostcss);

  // --- Add absoluteUrl filter (fixes "filter not found: absoluteUrl") ---
  eleventyConfig.addFilter("absoluteUrl", (url, base) => {
    try {
      if (!url && !base) return "";
      if (!base) return String(url || "");
      return new URL(String(url || ""), String(base)).toString();
    } catch {
      const stripEnd = s => String(s || "").replace(/\/+$/, "");
      const stripStart = s => String(s || "").replace(/^\/+/, "");
      if (!base) return String(url || "");
      if (!url) return String(base || "");
      return `${stripEnd(base)}/${stripStart(url)}`;
    }
  });

  // Static asset passthrough
  eleventyConfig.addPassthroughCopy("images");
  eleventyConfig.addPassthroughCopy("js");
  eleventyConfig.addPassthroughCopy("ads.txt");
  eleventyConfig.addPassthroughCopy("robots.txt");

  // Copy files from the `public` directory to the root of the site
  eleventyConfig.addPassthroughCopy({ "public/": "/" });

  // Pagefind UI assets
  eleventyConfig.addPassthroughCopy({
    "node_modules/@pagefind/ui/": "pagefind/"
  });

  // Watch CSS directory
  eleventyConfig.addWatchTarget("css/");

  // Chart.js vendor files
  eleventyConfig.addPassthroughCopy({
    "node_modules/chart.js/dist/chart.umd.js": "assets/vendor/chart.umd.js",
    "node_modules/chartjs-adapter-date-fns/dist/chartjs-adapter-date-fns.bundle.js":
      "assets/vendor/chartjs-adapter-date-fns.bundle.js",
  });
  eleventyConfig.addWatchTarget("node_modules/chart.js/dist/chart.umd.js");
  eleventyConfig.addWatchTarget(
    "node_modules/chartjs-adapter-date-fns/dist/chartjs-adapter-date-fns.bundle.min.js"
  );

  eleventyConfig.addCollection("tagsBySlug", (collectionApi) => buildTagsBySlug(collectionApi));

  // Pagination Collection: Generates pages for every tag (e.g. /tags/sf6/1/, /tags/sf6/2/)
  eleventyConfig.addCollection("pagedTags", (collectionApi) => {
    const pageSize = 10; // Set how many articles per page you want
    const allPosts = collectionApi.getAll().sort((a, b) => b.date - a.date);
    const tagMap = new Map();

    allPosts.forEach((post) => {
      const tags = post.data.tags || [];
      tags.forEach((rawTag) => {
        if (typeof rawTag !== "string") return;
        const tag = rawTag.trim();
        const lowerTag = tag.toLowerCase();

        if (!tag || 
            TAG_SKIP.has(lowerTag) || 
            lowerTag === 'all' || 
            lowerTag === 'posts' || 
            lowerTag.startsWith('highlight')) { 
          return; 
        }

        if (!tagMap.has(tag)) {
          tagMap.set(tag, []);
        }
        tagMap.get(tag).push(post);
      });
    });

    const pagedTags = [];

    tagMap.forEach((posts, tag) => {
      const totalPages = Math.ceil(posts.length / pageSize);
      // Use the same slugify settings as your buildTagsBySlug function
      const slug = slugify(tag, { lower: true, strict: true });
      const tagPermalinkBase = `/tags/${slug}/`;

      const hrefs = [];
      for (let i = 0; i < totalPages; i++) {
        hrefs.push(i === 0 ? tagPermalinkBase : `${tagPermalinkBase}${i + 1}/`);
      }

      for (let pageNumber = 0; pageNumber < totalPages; pageNumber++) {
        const start = pageNumber * pageSize;
        const end = start + pageSize;
        const pageItems = posts.slice(start, end);

        pagedTags.push({
          label: tag,
          items: pageItems,
          pageNumber: pageNumber,
          totalPages: totalPages,
          permalink: hrefs[pageNumber], // This feeds the permalink in tag.njk
          hrefs: hrefs,
          hrefPrevious: pageNumber > 0 ? hrefs[pageNumber - 1] : null,
          hrefNext: pageNumber < totalPages - 1 ? hrefs[pageNumber + 1] : null
        });
      }
    });

    if (process.env.ELEVENTY_ENV === 'development') {
      console.log('⚠️  DEV MODE: Limiting Tags to first 5 pages.');
      return pagedTags.slice(0, 5); 
    }

    return pagedTags;
  });

  // Players collection with unique slugs
  eleventyConfig.addCollection("players", function (collectionApi) {
    const root = collectionApi.getAll()[0];
    const playerProfiles = root?.data?.playerProfiles;
    if (!playerProfiles) {
      console.warn("⚠️ Player profiles data not found. 'collections.players' will be empty.");
      return [];
    }

    // Build a set of all player slugs that appear in character notable players
    const characterAnalytics = root?.data?.characterAnalytics || [];
    const notablePlayerSlugs = new Set();
    characterAnalytics.forEach((char) => {
      if (Array.isArray(char.notablePlayers)) {
        char.notablePlayers.forEach((player) => {
          if (player.slug) {
            notablePlayerSlugs.add(player.slug);
          }
        });
      }
    });

    const eligible = playerProfiles.filter((p) => {
      const results = Array.isArray(p?.results_1yr) ? p.results_1yr : [];
      const rankNum = typeof p?.rank === "number" ? p.rank : Number(p?.rank);
      const isTop200 = Number.isFinite(rankNum) && rankNum > 0 && rankNum <= 200;
      const isNotablePlayer = p.slug && notablePlayerSlugs.has(p.slug);
      const hasEnoughResults = results.length >= 3;
      return isTop200 || isNotablePlayer || hasEnoughResults;
    });

    const seen = new Map();
    const out = [];

    for (const p of eligible) {
      const base =
        (p.slug && String(p.slug)) ||
        (p.name ? slugify(String(p.name), { lower: true, strict: false }) : "");
      if (!base) continue;

      let unique = base;
      let i = 2;
      while (seen.has(unique)) {
        unique = `${base}-${i++}`;
      }
      seen.set(unique, true);

      out.push({
        ...p,
        slug: unique,
        uniqueSlug: unique,
      });
    }

    const sortedPlayers = out.sort((a, b) => (a.rank || Infinity) - (b.rank || Infinity));

    if (process.env.ELEVENTY_ENV === 'development') {
      console.log('⚠️ DEV MODE: Building only top 40 players for speed.');
      return sortedPlayers.slice(0, 40);
    }

    return sortedPlayers;
  });

  eleventyConfig.addCollection("newsFeed", function (collectionApi) {
  const allNews = collectionApi.getFilteredByTag("news");

  if (process.env.ELEVENTY_ENV === 'development') {
    console.log('⚠️  DEV MODE: Building only the 12 most recent news articles.');
    return allNews.slice(-12);
  }

  return allNews;
});

  eleventyConfig.setFrontMatterParsingOptions({
    excerpt: true,
    excerpt_separator: "",
  });

  eleventyConfig.addShortcode("year", () => `${new Date().getFullYear()}`);
  Object.keys(filters).forEach((name) => {
    eleventyConfig.addFilter(name, filters[name]);
  });

  eleventyConfig.addFilter("date", (dateObj, format = "LLL dd, yyyy") =>
    DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat(format)
  );

  eleventyConfig.addFilter("nl2p", (string) => {
    if (!string || typeof string !== "string") return "";
    const paras = string.split(/\r?\n/).filter((p) => p.length > 0);
    return paras.map((p) => `<p>${p}</p>`).join("\n");
  });

  eleventyConfig.addFilter("url_encode", (string) => {
    if (!string || typeof string !== "string") return "";
    return encodeURIComponent(string);
  });

  // Filter profiles array to only include items whose slug is in the collection
  eleventyConfig.addFilter("filterProfilesByCollection", (profiles, collection) => {
    if (!Array.isArray(profiles) || !Array.isArray(collection)) return [];
    const slugSet = new Set(collection.map(item => item.slug).filter(Boolean));
    return profiles.filter(profile => profile && profile.slug && slugSet.has(profile.slug));
  });

  eleventyConfig.addFilter("find", (array, key, value) => {
    if (!Array.isArray(array)) return undefined;
    return array.find((item) => item[key] === value);
  });

  const playerCollectionCache = new WeakMap();

  eleventyConfig.addFilter("getPlayerById", function(pid, playerCollection) {
    if (!pid) return null;
    if (!playerCollection || !Array.isArray(playerCollection)) return null;

    // 1. Check if we already built a "Cheat Sheet" (Map) for this specific collection
    let lookupMap = playerCollectionCache.get(playerCollection);

    // 2. If not, build it now (Runs only ONCE per build)
    if (!lookupMap) {
      lookupMap = new Map();
      
      playerCollection.forEach(item => {
        // We handle item.data (standard 11ty) or item (raw object)
        const d = item.data || item; 
        
        // Map multiple keys so you can find by ID, Slug, or Name
        if (d.id) lookupMap.set(String(d.id), d);
        if (d.slug) lookupMap.set(String(d.slug), d);
        if (d.name) lookupMap.set(String(d.name), d);
      });

      playerCollectionCache.set(playerCollection, lookupMap);
      console.log(`[Performance] Built fast lookup map for ${playerCollection.length} players.`);
    }

    // 3. Return the result instantly (O(1) speed instead of O(N))
    return lookupMap.get(String(pid));
  });

  eleventyConfig.addFilter("sortByFinish", (results) => {
    if (!Array.isArray(results)) return results;
    return [...results].sort((a, b) => {
      const finishA = parseInt(a.Finish, 10) || 9999;
      const finishB = parseInt(b.Finish, 10) || 9999;
      return finishA - finishB;
    });
  });

  eleventyConfig.addFilter("readableDate", (dateObj) =>
    DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat("LLL dd, yyyy")
  );

  eleventyConfig.addFilter("split", (string, separator) => {
    if (!string || typeof string !== "string") return [];
    return string.split(separator);
  });

  eleventyConfig.addFilter("values", (obj) => {
    if (!obj) return [];
    if (Array.isArray(obj)) return obj;
    return Object.values(obj);
  });

  const yearsCache = new WeakMap(); // Cache storage

  eleventyConfig.addFilter("extractYears", function (events) {
    // 1. Safety Check
    if (!Array.isArray(events)) return [];

    // 2. Cache Hit: Return immediately if we already did the math
    if (yearsCache.has(events)) {
      return yearsCache.get(events);
    }

    // 3. Cache Miss: Calculate the years
    const years = new Set();
    events.forEach((ev) => {
      if (ev && ev.date && typeof ev.date === "string") {
        const year = ev.date.slice(0, 4);
        if (year && /^\d{4}$/.test(year)) years.add(year);
      }
    });

    const result = Array.from(years).sort().reverse();

    // 4. Save result to cache
    yearsCache.set(events, result);

    return result;
  });

  eleventyConfig.addFilter("json", (value) => {
    if (value === undefined) return "null";
    try {
      const s = JSON.stringify(value);
      return (s ?? "null").replace(/</g, "\\u003c");
    } catch {
      return "null";
    }
  });

  eleventyConfig.addFilter("dateFormat", function (date) {
    if (!date) return "";
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return date;
    return dateObj.toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  });

  const STAT_ACRONYMS = new Set([
    "FGPI", "TDR", "PF", "MS", "AF12", "AF6", "AFM12", "AFM6",
    "APP", "APM", "V", "T3", "T8", "T16", "PR", "TR",
  ]);

  eleventyConfig.addFilter("sentenceCaseStat", (label) => {
    if (!label) return "";
    const s = String(label).trim();
    if (STAT_ACRONYMS.has(s)) return s;
    const lower = s.toLowerCase();
    return lower.replace(/([A-Za-z])/, (m) => m.toUpperCase());
  });

  eleventyConfig.addFilter("sortByOrder", function (array) {
    if (!Array.isArray(array)) return array;
    return [...array].sort((a, b) => {
      const orderA = a.order !== undefined ? a.order : 999;
      const orderB = b.order !== undefined ? b.order : 999;
      return orderA - orderB;
    });
  });

  // --- RELATED POSTS FILTER (Relevance Score Algorithm) ---
  eleventyConfig.addFilter("getRelated", function(collection, currentUrl, currentTags) {
    if (!collection || !currentTags) return [];

    // Tags that are too generic to count towards a high relevance score
    const ignoredTags = new Set([...TAG_SKIP, 'article']);

    // 1. Score every post in the collection
    const scoredPosts = collection.map(post => {
      // Normalize removing trailing slashes for comparison
const normalize = url => (url || "").replace(/\/+$/, "");
if (normalize(post.url) === normalize(currentUrl)) return { score: -1, post };

      let score = 0;
      const otherTags = post.data.tags || [];

      // 2. Calculate score based on matching tags
      currentTags.forEach(tag => {
        const cleanTag = tag.toLowerCase();
        // Only count the tag if it's not in the ignored list AND the other post has it
        if (!ignoredTags.has(cleanTag) && otherTags.map(t => t.toLowerCase()).includes(cleanTag)) {
          score++;
        }
      });

      return { score, post };
    });

    // 3. Filter for matches, sort by highest score, take top 3
    return scoredPosts
      .filter(item => item.score > 0) // Must have at least one meaningful tag in common
      .sort((a, b) => b.score - a.score) // Highest score first
      .slice(0, 3) // Take top 3
      .map(item => item.post); // Return just the post object
  });
  // -----------------------------------------------------

  eleventyConfig.addDataExtension("js", { parser: "javascript" });
  eleventyConfig.setTemplateFormats(["md", "njk", "html", "11ty.js"]);

  return {
    dir: {
      input: ".",
      includes: "_includes",
      data: "_data",
      output: "_site",
    },
    pathPrefix: "/",
  };
};