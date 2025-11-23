const { TAG_PAGE_SIZE } = require("./_eleventy/tagConfig");

function buildTagPages(tags = []) {
  const pages = [];

  tags.forEach((tag) => {
    if (!tag || typeof tag.slug !== "string") return;
    const slug = tag.slug;
    const label = tag.label || slug;
    const items = Array.isArray(tag.items) ? tag.items : [];
    const totalItems = items.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / TAG_PAGE_SIZE));
    const hrefs = Array.from({ length: totalPages }, (_, index) =>
      index === 0 ? `/tags/${slug}/` : `/tags/${slug}/page/${index + 1}/`
    );

    for (let pageNumber = 0; pageNumber < totalPages; pageNumber += 1) {
      const sliceStart = pageNumber * TAG_PAGE_SIZE;
      const sliceEnd = sliceStart + TAG_PAGE_SIZE;
      pages.push({
        slug,
        label,
        items: items.slice(sliceStart, sliceEnd),
        pageNumber,
        totalPages,
        totalItems,
        pageSize: TAG_PAGE_SIZE,
        hrefs,
        hrefCurrent: hrefs[pageNumber],
        hrefPrevious: pageNumber > 0 ? hrefs[pageNumber - 1] : null,
        hrefNext: pageNumber < totalPages - 1 ? hrefs[pageNumber + 1] : null,
      });
    }
  });

  return pages;
}

function truncateLabel(label = "", max = 34) {
  const text = String(label);
  if (text.length <= max) return text;
  return text.slice(0, max);
}

module.exports = () => ({
  layout: "layout.njk",
  navHighlight: "Home",
  pagination: {
    data: "collections.tagsBySlug",
    size: 1,
    alias: "tagPage",
    addAllPagesToCollections: true,
    before: (tags) => buildTagPages(tags),
  },
  permalink: (data) => data?.tagPage?.hrefCurrent || "/tags/",
  eleventyComputed: {
    title: (data) => {
      const { tagPage } = data;
      const label = tagPage?.label || "Tag";
      let pageTitle = `${truncateLabel(label)} News | FGC Top Players`;
      if (tagPage?.pageNumber > 0) {
        pageTitle = `Page ${tagPage.pageNumber + 1} | ${pageTitle}`;
      }
      return pageTitle;
    },
  },
});
