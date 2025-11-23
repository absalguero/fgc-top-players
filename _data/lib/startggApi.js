// Helper module for start.gg API calls
require("dotenv").config();
const EleventyFetch = require("@11ty/eleventy-fetch");
const path = require("path");
const os = require("os");
const fs = require("fs").promises;

const FETCH_CACHE_DIR =
  process.env.STARTGG_FETCH_CACHE_DIR ||
  path.join(os.tmpdir(), "fgctp_eleventy_fetch");

const STARTGG_API_URL = "https://api.start.gg/gql/alpha";
const API_TOKEN = process.env.STARTGG_API_TOKEN;

if (!API_TOKEN) {
  console.warn("�s��,? STARTGG_API_TOKEN not found in .env file");
}

async function ensureDirectory(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    if (error.code !== "EEXIST") {
      throw error;
    }
  }
}

/**
 * Execute a GraphQL query against start.gg API
 */
async function query(graphqlQuery, variables = {}) {
  try {
    await ensureDirectory(FETCH_CACHE_DIR);
    const response = await EleventyFetch(STARTGG_API_URL, {
      directory: FETCH_CACHE_DIR,
      duration: "30d", // Cache for 30 days (matches player-level cache)
      type: "json",
      fetchOptions: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({
          query: graphqlQuery,
          variables: variables,
        }),
        timeout: 30000, // 30 second timeout per request
      },
    });

    if (response.errors) {
      console.error("start.gg API errors:", response.errors);
      return null;
    }

    return response.data;
  } catch (error) {
    console.error("Error querying start.gg API:", error.message);
    return null;
  }
}

/**
 * Get user (player) social media links by slug
 * @param {string} userSlug - The user slug from start.gg (e.g., "menard", "punk")
 * @returns {Promise<Object|null>} - Social media links object or null
 */
async function getUserSocials(userSlug) {
  if (!userSlug) return null;

  const graphqlQuery = `
    query GetUserSocials($userSlug: String!) {
      user(slug: $userSlug) {
        id
        player {
          gamerTag
        }
        authorizations(types: [TWITTER, TWITCH, DISCORD]) {
          externalUsername
          type
          url
        }
      }
    }
  `;

  const data = await query(graphqlQuery, { userSlug: String(userSlug).trim() });

  if (!data || !data.user) {
    console.warn(`�s��,? No user found for slug: ${userSlug}`);
    return null;
  }

  // Process authorizations into a clean object
  const socials = {
    twitter: null,
    twitch: null,
    discord: null,
  };

  const authorizations = data.user.authorizations || [];

  authorizations.forEach((auth) => {
    if (!auth || !auth.type) {
      return;
    }

    const url = auth.url ? String(auth.url).trim() : null;
    const username = auth.externalUsername
      ? String(auth.externalUsername).trim()
      : null;

    if (auth.type === "TWITTER") {
      if (!socials.twitter) {
        socials.twitter = url || username;
      }
    } else if (auth.type === "TWITCH") {
      if (!socials.twitch) {
        socials.twitch = url || username;
      }
    } else if (auth.type === "DISCORD") {
      if (!socials.discord) {
        // Prefer actual invite URLs when present, otherwise fall back to username
        socials.discord = url || username;
      }
    }
  });

  // Only return if at least one social is found
  if (socials.twitter || socials.twitch || socials.discord) {
    return socials;
  }

  console.warn(
    `�s��,? No social links found for user ${data.user.player?.gamerTag || userSlug}`
  );
  return null;
}

/**
 * Batch fetch multiple user social media links
 * @param {Array<string>} userSlugs - Array of user slugs (e.g., ["menard", "punk"])
 * @returns {Promise<Object>} - Map of userSlug -> socials object {twitter, twitch, discord}
 */
async function batchGetUserSocials(userSlugs) {
  if (!userSlugs || userSlugs.length === 0) return {};

  // start.gg API doesn't have a batch endpoint, so we'll fetch individually
  // but cache results for subsequent builds
  const results = {};
  const total = userSlugs.length;

  for (let i = 0; i < userSlugs.length; i++) {
    const userSlug = userSlugs[i];

    // Progress logging every 10 players
    if (i % 10 === 0) {
      console.log(`  �?3 Progress: ${i}/${total} players...`);
    }

    const socials = await getUserSocials(userSlug);
    if (socials) {
      results[userSlug] = socials;
    }

    // Small delay to avoid rate limiting (250ms between requests)
    if (i < userSlugs.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  return results;
}

module.exports = {
  query,
  getUserSocials,
  batchGetUserSocials,
};
