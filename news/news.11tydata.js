const slugify = require("slugify");

module.exports = {
  eleventyComputed: {
    permalink: function(data) {
      // 1. If the Markdown file has a specific permalink set manually, use it.
      // (This accesses the 'permalink' from the Front Matter before computation)
      if (data.permalink) {
        return data.permalink;
      }

      // 2. Generate the dynamic permalink using the title.
      // We check if title exists to prevent errors on draft files.
      if (data.title) {
        const slug = slugify(data.title, { lower: true, strict: true });
        return `/news/${slug}/`;
      }

      // Fallback: If no title exists, return undefined (Eleventy will use the default filename).
      return undefined;
    }
  }
};