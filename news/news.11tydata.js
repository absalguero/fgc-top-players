const slugify = require("slugify");

module.exports = {
  eleventyComputed: {
    permalink: function(data) {
      // If in development mode, skip building articles older than 14 days
      if (process.env.ELEVENTY_ENV === 'development') {
        const date = new Date(data.date);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 14); // <--- Changed to 14 days

        // If article is too old, return false (skips writing the file)
        if (date < cutoff) {
          return false;
        }
      }

      // 1. If the Markdown file has a specific permalink set manually, use it.
      if (data.permalink) {
        return data.permalink;
      }

      // 2. Generate the dynamic permalink using the title.
      if (data.title) {
        const slug = slugify(data.title, { lower: true, strict: true });
        return `/news/${slug}/`;
      }

      // Fallback
      return undefined;
    }
  }
};