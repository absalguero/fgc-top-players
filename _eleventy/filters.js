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

// =============================================================================
// GLOBAL CONFIG & CONSTANTS
// =============================================================================

const STAT_ACRONYMS = new Set([
  "FGPI", "TDR", "PF", "MS", "AF12", "AF6", "AFM12", "AFM6",
  "APP", "APM", "V", "T3", "T8", "T16", "PR", "TR",
  "CPV", "T3R", "CMS", "CPF", "TS", "TP", "RDI",
]);

const WORD_CHAR = /[A-Za-z0-9_]/;
const SHOW_TEXT = 4; // NodeFilter.SHOW_TEXT
const SKIP_AUTOLINK_TAGS = new Set([
  "A", "CODE", "PRE", "SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA",
]);

const EXTRA_KEYWORDS = [
  { key: "extra:tournament", label: "tournament", url: "/tournament-results/", type: "section", maxMatches: 1 },
  { key: "extra:tournaments", label: "tournaments", url: "/tournament-results/", type: "section", maxMatches: 1 },
  { key: "feature:player-comparison", label: "player comparison", url: "/player-comparison/", type: "feature", maxMatches: 1 },
  { key: "feature:character-comparison", label: "character comparison", url: "/character-comparison/", type: "feature", maxMatches: 1 },
  { key: "feature:player-directory", label: "player directory", url: "/player-profiles/", type: "feature", maxMatches: 1 },
];

const ANALYTICS_TERMS = [
  { key: "glossary:fgpi", label: "FGPI", url: "/fgpi/" },
  { key: "glossary:tdr", label: "TDR", url: "/analytics-glossary/#tdr" },
  { key: "glossary:pf", label: "PF", url: "/analytics-glossary/#pf" },
  { key: "glossary:ms", label: "MS", url: "/analytics-glossary/#ms" },
  { key: "glossary:app", label: "APP", url: "/analytics-glossary/#app" },
  { key: "glossary:apm", label: "APM", url: "/analytics-glossary/#apm" },
  { key: "glossary:cpv", label: "CPV", url: "/analytics-glossary/#cpv" },
  { key: "glossary:t3r", label: "T3R", url: "/analytics-glossary/#t3r" },
  { key: "glossary:cms", label: "CMS", url: "/analytics-glossary/#cms" },
  { key: "glossary:cpf", label: "CPF", url: "/analytics-glossary/#cpf" },
  { key: "glossary:ts", label: "TS", url: "/analytics-glossary/#ts" },
  { key: "glossary:tp", label: "TP", url: "/analytics-glossary/#tp" },
  { key: "glossary:rdi", label: "RDI", url: "/analytics-glossary/#rdi" },
  { key: "glossary:performance-floor", label: "Performance Floor", url: "/analytics-glossary/#pf" },
  { key: "glossary:momentum-score", label: "Momentum Score", url: "/analytics-glossary/#ms" },
  { key: "glossary:performance-viability", label: "Competitive Performance Viability", url: "/analytics-glossary/#cpv" },
  { key: "glossary:top-3-rate", label: "Top-3 Rate", url: "/analytics-glossary/#t3r" },
  { key: "glossary:ranking-system", label: "ranking system", url: "/reference/ranking-system/" },
];

const TYPE_PRIORITY = {
  player: 0,
  tag: 1,
  character: 2,
  glossary: 3,
  section: 4,
  feature: 5,
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function capFirstAlphaToken(token) {
  const m = token.match(/^([^A-Za-z]*)([A-Za-z])(.*)$/);
  if (!m) return token;
  const [, pre, first, rest] = m;
  return pre + first.toUpperCase() + rest.toLowerCase();
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasSkipAncestor(node) {
  let el = node.parentElement;
  while (el) {
    if (SKIP_AUTOLINK_TAGS.has(el.tagName)) return true;
    if (el.getAttribute && el.getAttribute("data-no-autolink") !== null) return true;
    if (el.classList && (el.classList.contains("no-autolink") || el.classList.contains("auto-link"))) return true;
    el = el.parentElement;
  }
  return false;
}

function isBoundaryChar(char) {
  return !char || !WORD_CHAR.test(char);
}

// =============================================================================
// CACHED ENTRY BUILDING (THE PERFORMANCE FIX)
// =============================================================================

// Cache the expensive regex list based on the 'collections' object
const entryCache = new WeakMap();

function buildGlobalEntries(playerProfiles, collections) {
  // 1. Build Players
  const collectionsPlayers = Array.isArray(collections?.players) ? collections.players : [];
  const playersToLink = collectionsPlayers.length > 0
    ? collectionsPlayers
    : (Array.isArray(playerProfiles) ? playerProfiles.filter((player) => {
        if (!player || typeof player.name !== "string" || !player.slug) return false;
        const rank = Number.isFinite(player.rank) ? player.rank : null;
        return rank && rank > 0 && rank <= 200;
      }) : []);

  const playerEntries = playersToLink
    .filter((player) => player && typeof player.name === "string" && player.slug && player.name.trim())
    .flatMap((player) => {
      const entries = [];
      const primaryLabel = player.name.trim();
      
      entries.push({
        key: `player:${player.slug}`,
        label: primaryLabel,
        url: `/players/${player.slug}/`,
        type: "player",
        maxMatches: 1,
        caseSensitive: false,
      });

      if (player.englishName && typeof player.englishName === "string") {
        const englishLabel = player.englishName.trim();
        if (englishLabel && englishLabel.toLowerCase() !== primaryLabel.toLowerCase()) {
          entries.push({
            key: `player:${player.slug}`,
            label: englishLabel,
            url: `/players/${player.slug}/`,
            type: "player",
            maxMatches: 1,
            caseSensitive: false,
          });
        }
      }
      return entries;
    });

  // 2. Build Tags
  const tags = Array.isArray(collections?.tagsBySlug) ? collections.tagsBySlug : [];
  const tagEntries = tags
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
    });

  // 3. Build Characters
  const characterEntries = [];
  if (Array.isArray(characterMasterList)) {
    characterMasterList
      .filter((entry) => entry && typeof entry.name === "string" && entry.name.trim())
      .forEach((entry) => {
        const label = entry.name.trim();
        const slug = slugify(label, { lower: true, strict: true });
        
        characterEntries.push({
          key: `character:${slug}`,
          label,
          url: `/characters/${slug}/`,
          type: "character",
          maxMatches: 1,
        });

        const shortNameMatch = label.match(/^[A-Z]\.\s+(.+)$/);
        if (shortNameMatch) {
          characterEntries.push({
            key: `character:${slug}-short`,
            label: shortNameMatch[1],
            url: `/characters/${slug}/`,
            type: "character",
            maxMatches: 1,
          });
        }
      });
  }

  // 4. Build Glossary & Extras
  const glossaryEntries = ANALYTICS_TERMS.map((term) => ({
    ...term,
    url: term.url || "/analytics-glossary/",
    type: "glossary",
    maxMatches: term.label.length <= 4 ? 2 : 1,
  }));

  const extraEntries = EXTRA_KEYWORDS.map(entry => ({ ...entry }));

  // 5. Enhance Players with Tag Data
  const allPlayerNames = new Set();
  if (Array.isArray(playerProfiles)) {
    playerProfiles.forEach(player => {
      if (player?.name) allPlayerNames.add(player.name.trim().toLowerCase());
      if (player?.englishName) allPlayerNames.add(player.englishName.trim().toLowerCase());
    });
  }

  const playersWithPages = new Set(playerEntries.map(p => p.label.toLowerCase()));
  const tagsByLabel = new Map(tagEntries.map(t => [t.label.toLowerCase(), t.url]));

  const enhancedPlayerEntries = playerEntries.map(player => {
    const tagUrl = tagsByLabel.get(player.label.toLowerCase());
    return tagUrl ? { ...player, tagUrl } : player;
  });

  const enhancedTagEntries = tagEntries.map(tag => {
    const labelLower = tag.label.toLowerCase();
    const isPlayerTag = allPlayerNames.has(labelLower);
    const hasProfile = playersWithPages.has(labelLower);
    if (isPlayerTag && !hasProfile) {
      return { ...tag, showIconOnly: true, maxMatches: 1 };
    }
    return tag;
  });

  // 6. Combine and Regex
  const rawEntries = [
    ...enhancedPlayerEntries,
    ...enhancedTagEntries,
    ...characterEntries,
    ...glossaryEntries,
    ...extraEntries,
  ];

  const entriesWithRegex = rawEntries
    .filter((entry) => entry.label && entry.url)
    .map((entry) => ({
      ...entry,
      regex: new RegExp(escapeRegExp(entry.label), entry.caseSensitive ? "g" : "gi"),
    }));

  // 7. Sort by Priority and Length (Longer first)
  entriesWithRegex.sort((a, b) => {
    const lenDiff = b.label.length - a.label.length;
    if (lenDiff !== 0) return lenDiff;
    const priDiff = (TYPE_PRIORITY[a.type] ?? 99) - (TYPE_PRIORITY[b.type] ?? 99);
    if (priDiff !== 0) return priDiff;
    return a.label.localeCompare(b.label);
  });

  // 8. Deduplicate
  const seenLabels = new Set();
  return entriesWithRegex.filter((entry) => {
    const key = entry.label.toLowerCase();
    if (entry.showIconOnly) return true;
    if (seenLabels.has(key)) return false;
    seenLabels.add(key);
    return true;
  });
}

// =============================================================================
// MAIN LOGIC
// =============================================================================

function findFirstMatch(text, entries, linkCounts) {
  let best = null;

  for (const entry of entries) {
    // Check max matches
    const used = linkCounts.get(entry.key) || 0;
    if (entry.maxMatches !== undefined && used >= entry.maxMatches) continue;

    const regex = entry.regex;
    regex.lastIndex = 0;
    const match = regex.exec(text);
    if (!match) continue;

    const start = match.index;
    const matchedText = match[0];
    if (!matchedText || !matchedText.trim()) continue;

    // Word boundary check
    const beforeChar = start > 0 ? text[start - 1] : "";
    const afterChar = start + matchedText.length < text.length ? text[start + matchedText.length] : "";
    if (!isBoundaryChar(beforeChar) || !isBoundaryChar(afterChar)) continue;

    if (
      !best ||
      start < best.index ||
      (start === best.index && matchedText.length > best.match.length)
    ) {
      best = { entry, index: start, match: matchedText };
    }
  }
  return best;
}

function processTextNode(document, node, entries, linkCounts) {
  let text = node.nodeValue;
  if (!text || !text.trim()) return;

  const parent = node.parentNode;
  if (!parent) return;

  while (text) {
    const result = findFirstMatch(text, entries, linkCounts);
    if (!result) break;

    const { entry, index, match } = result;

    if (index > 0) {
      parent.insertBefore(document.createTextNode(text.slice(0, index)), node);
    }

    if (entry.showIconOnly) {
      parent.insertBefore(document.createTextNode(match), node);
      const tagIcon = document.createElement("a");
      tagIcon.setAttribute("href", entry.url);
      tagIcon.setAttribute("data-player-tag", "true");
      tagIcon.className = "player-tag-icon";
      tagIcon.setAttribute("aria-label", `View ${match} tag page`);
      tagIcon.innerHTML = '<i class="fas fa-tag"></i>';
      parent.insertBefore(tagIcon, node);
    } else {
      const anchor = document.createElement("a");
      anchor.setAttribute("href", entry.url);
      anchor.setAttribute("data-auto-link", entry.type);
      anchor.className = `auto-link auto-link--${entry.type}`;
      anchor.textContent = match;
      parent.insertBefore(anchor, node);

      if (entry.type === "player" && entry.tagUrl) {
        const tagIcon = document.createElement("a");
        tagIcon.setAttribute("href", entry.tagUrl);
        tagIcon.setAttribute("data-player-tag", "true");
        tagIcon.className = "player-tag-icon";
        tagIcon.setAttribute("aria-label", `View ${match} tag page`);
        tagIcon.innerHTML = '<i class="fas fa-tag"></i>';
        parent.insertBefore(tagIcon, node);
      }
    }

    linkCounts.set(entry.key, (linkCounts.get(entry.key) || 0) + 1);
    text = text.slice(index + match.length);
  }

  if (text) {
    node.nodeValue = text;
  } else {
    parent.removeChild(node);
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

filters.titleCaseStat = function (label) {
  if (!label) return "";
  const s = String(label).trim();
  if (!s) return "";
  return s.split(/\s+/).map((word) => {
    const base = word.replace(/[^A-Za-z0-9]/g, "");
    if (base && STAT_ACRONYMS.has(base.toUpperCase())) {
      return word.replace(/[A-Za-z0-9]+/, (seg) => seg.toUpperCase());
    }
    return capFirstAlphaToken(word);
  }).join(" ");
};

filters.sentenceCaseStat = function (label) {
  if (!label) return "";
  const s = String(label).trim();
  if (STAT_ACRONYMS.has(s)) return s;
  const lower = s.toLowerCase();
  return lower.replace(/([A-Za-z])/, (m) => m.toUpperCase());
};

filters.autoLink = function autoLink(content, page = {}, collections = {}, playerProfiles) {
  if (!content || typeof content !== "string") return content;
  if (typeof parseHTML !== "function") return content;

  // --- PERFORMANCE FIX START ---
  // 1. Check Cache
  let entries = entryCache.get(collections);
  
  // 2. Build Cache if missing (Runs ONCE)
  if (!entries) {
    entries = buildGlobalEntries(playerProfiles, collections);
    entryCache.set(collections, entries);
    console.log(`[AutoLink] Built and cached ${entries.length} autolink entries.`);
  }

  // 3. Filter for current page (Fast, shallow filtering)
  const pageUrl = page && typeof page.url === "string" ? page.url : "";
  const activeEntries = entries.filter(e => e.url !== pageUrl);
  // --- PERFORMANCE FIX END ---

  if (activeEntries.length === 0) return content;

  const { document } = parseHTML(`<div data-autolink-root="true">${content}</div>`);
  const root = document.querySelector("[data-autolink-root]");
  if (!root) return content;

  const walker = document.createTreeWalker(root, SHOW_TEXT);
  const linkCounts = new Map();

  let current = walker.nextNode();
  while (current) {
    if (!hasSkipAncestor(current)) {
      processTextNode(document, current, activeEntries, linkCounts);
    }
    current = walker.nextNode();
  }

  return root.innerHTML;
};

filters.getPlayerSocials = function (playerSlug, startggSocials) {
  if (!playerSlug || !startggSocials || !startggSocials.players) return null;
  const players = startggSocials.players;
  const slugKey = String(playerSlug);
  return players[slugKey] || players[slugKey.toLowerCase()] || null;
};