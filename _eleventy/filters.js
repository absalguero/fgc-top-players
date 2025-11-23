let parseHTML = null;
try {
  ({ parseHTML } = require("linkedom"));
} catch (err) {
  console.warn(
    "[autoLink] Optional dependency 'linkedom' not found. Run `npm install` to enable auto-linking."
  );
}
const slugify = require("slugify");
const characterMasterList = require("../_data/characterMasterList.js");

const filters = (module.exports = module.exports || {});

const STAT_ACRONYMS = new Set([
  "FGPI",
  "TDR",
  "PF",
  "MS",
  "AF12",
  "AF6",
  "AFM12",
  "AFM6",
  "APP",
  "APM",
  "V",
  "T3",
  "T8",
  "T16",
  "PR",
  "TR",
]);

const WORD_CHAR = /[A-Za-z0-9_]/;
const SHOW_TEXT = 4; // NodeFilter.SHOW_TEXT
const SKIP_AUTOLINK_TAGS = new Set([
  "A",
  "CODE",
  "PRE",
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "TEXTAREA",
]);

const EXTRA_KEYWORDS = [
  {
    key: "extra:tournament",
    label: "tournament",
    url: "/tournament-results/",
    type: "section",
    maxMatches: 1,
  },
  {
    key: "extra:tournaments",
    label: "tournaments",
    url: "/tournament-results/",
    type: "section",
    maxMatches: 1,
  },
  {
    key: "feature:player-comparison",
    label: "player comparison",
    url: "/player-comparison/",
    type: "feature",
    maxMatches: 1,
  },
  {
    key: "feature:character-comparison",
    label: "character comparison",
    url: "/character-comparison/",
    type: "feature",
    maxMatches: 1,
  },
  {
    key: "feature:player-directory",
    label: "player directory",
    url: "/player-profiles/",
    type: "feature",
    maxMatches: 1,
  },
];

const ANALYTICS_TERMS = [
  { key: "glossary:fgpi", label: "FGPI" },
  { key: "glossary:tdr", label: "TDR" },
  { key: "glossary:performance-index", label: "performance index" },
  { key: "glossary:momentum-score", label: "momentum score" },
  { key: "glossary:top-40-streak", label: "top 40 streak" },
  { key: "glossary:ranking-system", label: "ranking system" },
];

const TYPE_PRIORITY = {
  player: 0,
  tag: 1,
  character: 2,
  glossary: 3,
  section: 4,
  feature: 5,
};

function capFirstAlphaToken(token) {
  const m = token.match(/^([^A-Za-z]*)([A-Za-z])(.*)$/);
  if (!m) return token;
  const [, pre, first, rest] = m;
  return pre + first.toUpperCase() + rest.toLowerCase();
}

filters.titleCaseStat = function (label) {
  if (!label) return "";
  const s = String(label).trim();
  if (!s) return "";

  return s
    .split(/\s+/)
    .map((word) => {
      const base = word.replace(/[^A-Za-z0-9]/g, "");
      if (base && STAT_ACRONYMS.has(base.toUpperCase())) {
        return word.replace(/[A-Za-z0-9]+/, (seg) => seg.toUpperCase());
      }
      return capFirstAlphaToken(word);
    })
    .join(" ");
};

filters.sentenceCaseStat =
  filters.sentenceCaseStat ||
  function (label) {
    if (!label) return "";
    const s = String(label).trim();
    if (STAT_ACRONYMS.has(s)) return s;
    const lower = s.toLowerCase();
    return lower.replace(/([A-Za-z])/, (m) => m.toUpperCase());
  };

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasSkipAncestor(node) {
  let el = node.parentElement;
  while (el) {
    if (SKIP_AUTOLINK_TAGS.has(el.tagName)) return true;
    if (el.getAttribute && el.getAttribute("data-no-autolink") !== null) {
      return true;
    }
    if (el.classList) {
      if (el.classList.contains("no-autolink") || el.classList.contains("auto-link")) {
        return true;
      }
    }
    el = el.parentElement;
  }
  return false;
}

function buildPlayerEntries(playerProfiles, pageUrl) {
  if (!Array.isArray(playerProfiles)) return [];

  return playerProfiles
    .filter((player) => {
      if (!player || typeof player.name !== "string" || !player.slug) return false;
      const name = player.name.trim();
      if (!name) return false;
      const rank = Number.isFinite(player.rank) ? player.rank : null;
      if (rank === null) return false;
      if (rank <= 0 || rank > 300) return false;
      return true;
    })
    .map((player) => ({
      key: `player:${player.slug}`,
      label: player.name.trim(),
      url: `/players/${player.slug}/`,
      type: "player",
      maxMatches: 2,
    }))
    .filter((entry) => entry.url !== pageUrl);
}

function buildTagEntries(collections, pageUrl) {
  const tags = Array.isArray(collections?.tagsBySlug) ? collections.tagsBySlug : [];
  return tags
    .filter((tag) => tag && typeof tag.label === "string" && tag.label.trim())
    .map((tag) => {
      const label = tag.label.trim();
      const slug = tag.slug || slugify(label, { lower: true, strict: true });
      return {
        key: `tag:${slug}`,
        label,
        url: `/tags/${slug}/`,
        type: "tag",
        maxMatches: 1,
      };
    })
    .filter((entry) => entry.url !== pageUrl);
}

function buildCharacterEntries(pageUrl) {
  if (!Array.isArray(characterMasterList)) return [];
  return characterMasterList
    .filter((entry) => entry && typeof entry.name === "string" && entry.name.trim())
    .map((entry) => {
      const label = entry.name.trim();
      const slug = slugify(label, { lower: true, strict: true });
      return {
        key: `character:${slug}`,
        label,
        url: `/characters/${slug}/`,
        type: "character",
        maxMatches: 1,
      };
    })
    .filter((entry) => entry.url !== pageUrl);
}

function buildGlossaryEntries(pageUrl) {
  return ANALYTICS_TERMS.map((term) => ({
    ...term,
    url:
      term.key === "glossary:ranking-system"
        ? "/reference/ranking-system/"
        : "/analytics-glossary/",
    type: "glossary",
    maxMatches: term.label.includes("FGPI") || term.label.includes("TDR") ? 2 : 1,
  })).filter((entry) => entry.url !== pageUrl);
}

function buildExtraEntries(pageUrl) {
  return EXTRA_KEYWORDS.filter((entry) => entry.url !== pageUrl).map((entry) => ({
    ...entry,
  }));
}

function prepareEntries(playerProfiles, collections, pageUrl) {
  const rawEntries = [
    ...buildPlayerEntries(playerProfiles, pageUrl),
    ...buildTagEntries(collections, pageUrl),
    ...buildCharacterEntries(pageUrl),
    ...buildGlossaryEntries(pageUrl),
    ...buildExtraEntries(pageUrl),
  ];

  const entriesWithRegex = rawEntries
    .filter((entry) => entry.label && entry.url)
    .map((entry) => ({
      ...entry,
      regex: new RegExp(escapeRegExp(entry.label), "gi"),
    }));

  entriesWithRegex.sort((a, b) => {
    const lenDiff = b.label.length - a.label.length;
    if (lenDiff !== 0) return lenDiff;
    const priDiff = (TYPE_PRIORITY[a.type] ?? 99) - (TYPE_PRIORITY[b.type] ?? 99);
    if (priDiff !== 0) return priDiff;
    return a.label.localeCompare(b.label);
  });

  const seenLabels = new Set();
  return entriesWithRegex.filter((entry) => {
    const key = `${entry.type}:${entry.label.toLowerCase()}`;
    if (seenLabels.has(key)) return false;
    seenLabels.add(key);
    return true;
  });
}

function isBoundaryChar(char) {
  return !char || !WORD_CHAR.test(char);
}

function findFirstMatch(text, entries, linkCounts) {
  let best = null;

  for (const entry of entries) {
    const used = linkCounts.get(entry.key) || 0;
    if (entry.maxMatches !== undefined && used >= entry.maxMatches) continue;

    const regex = entry.regex;
    regex.lastIndex = 0;
    const match = regex.exec(text);
    if (!match) continue;

    const start = match.index;
    const matchedText = match[0];
    if (!matchedText || !matchedText.trim()) continue;

    const beforeChar = start > 0 ? text[start - 1] : "";
    const afterChar =
      start + matchedText.length < text.length ? text[start + matchedText.length] : "";
    if (!isBoundaryChar(beforeChar) || !isBoundaryChar(afterChar)) continue;

    if (
      !best ||
      start < best.index ||
      (start === best.index && matchedText.length > best.match.length)
    ) {
      best = {
        entry,
        index: start,
        match: matchedText,
      };
    }
  }

  return best;
}

function processTextNode(document, node, entries, linkCounts) {
  let text = node.nodeValue;
  if (!text || !text.trim()) {
    return;
  }

  const parent = node.parentNode;
  if (!parent) return;

  while (text) {
    const result = findFirstMatch(text, entries, linkCounts);
    if (!result) break;

    const { entry, index, match } = result;

    if (index > 0) {
      parent.insertBefore(document.createTextNode(text.slice(0, index)), node);
    }

    const anchor = document.createElement("a");
    anchor.setAttribute("href", entry.url);
    anchor.setAttribute("data-auto-link", entry.type);
    anchor.className = `auto-link auto-link--${entry.type}`;
    anchor.textContent = match;
    parent.insertBefore(anchor, node);

    linkCounts.set(entry.key, (linkCounts.get(entry.key) || 0) + 1);
    text = text.slice(index + match.length);
  }

  if (text) {
    node.nodeValue = text;
  } else {
    parent.removeChild(node);
  }
}

filters.autoLink = function autoLink(content, page = {}, collections = {}, playerProfiles) {
  if (!content || typeof content !== "string") return content;
  if (typeof parseHTML !== "function") return content;

  const pageUrl = page && typeof page.url === "string" ? page.url : "";
  const entries = prepareEntries(playerProfiles, collections, pageUrl);
  if (entries.length === 0) return content;

  const { document } = parseHTML(`<div data-autolink-root="true">${content}</div>`);
  const root = document.querySelector("[data-autolink-root]");
  if (!root) return content;

  const walker = document.createTreeWalker(root, SHOW_TEXT);
  const linkCounts = new Map();

  let current = walker.nextNode();
  while (current) {
    if (!hasSkipAncestor(current)) {
      processTextNode(document, current, entries, linkCounts);
    }
    current = walker.nextNode();
  }

  return root.innerHTML;
};

/**
 * Get player social media links from start.gg
 * @param {string} playerSlug - The player slug from start.gg (e.g., "menard", "punk")
 * @param {object} startggSocials - The startggSocials data object
 * @returns {object|null} - Social links object {twitter, twitch, discord} or null if not found
 */
filters.getPlayerSocials = function (playerSlug, startggSocials) {
  if (!playerSlug || !startggSocials || !startggSocials.players) {
    return null;
  }

  const players = startggSocials.players;
  const slugKey = String(playerSlug);
  return players[slugKey] || players[slugKey.toLowerCase()] || null;
};
