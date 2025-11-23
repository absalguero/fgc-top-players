# start.gg Images - Quick Start Checklist

## ✅ What I've Set Up For You

1. **API Helper Module** (`_data/lib/startggApi.js`)
   - Handles all start.gg GraphQL API calls
   - Uses your existing `STARTGG_API_TOKEN` from `.env`
   - Includes caching to avoid rate limits

2. **Data Fetcher** (`_data/startggImages.js`)
   - Reads your Google Sheet with Player ID and Event ID columns
   - Fetches images from start.gg API for all IDs
   - Caches results in `_data/startgg_images_cache.json`

3. **Template Filters** (added to `_eleventy/filters.js`)
   - `getPlayerImage` - Get player image by ID
   - `getEventImage` - Get event image by ID
   - Both filters include fallback support

4. **Documentation** (`START_GG_IMAGES_SETUP.md`)
   - Complete setup guide
   - Usage examples
   - Troubleshooting tips

## 🚀 Quick Start (3 Steps)

### Step 1: Update Google Sheet URL

Edit `_data/startggImages.js` (line 59-60) and replace with your Google Sheet's published CSV URL:

```javascript
const googleSheetURL =
  "https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/gviz/tq?tqx=out:csv&gid=YOUR_GID";
```

**How to get the URL:**
1. Open your Google Sheet
2. File → Share → Publish to web
3. Select your sheet tab
4. Choose "Comma-separated values (.csv)"
5. Copy the URL

### Step 2: Test the Build

Run your build to fetch images:

```bash
npm run build
```

Check that `_data/startgg_images_cache.json` was created with image URLs.

### Step 3: Use in Templates

Replace local image paths with the filter:

**Before:**
```njk
<img src="/images/players/{{ player.slug }}.png" alt="{{ player.name }}">
```

**After:**
```njk
<img src="{{ player.startggId | getPlayerImage(startggImages) }}" alt="{{ player.name }}">
```

## 📝 Example: Update Player Profile Template

1. Open `profiles/player-profile-template.njk`
2. Find the player image tag
3. Replace with:

```njk
{% if player.startggUserId %}
  {# Use start.gg image if we have the ID #}
  <img
    src="{{ player.startggUserId | getPlayerImage(startggImages, player.photoURL) }}"
    alt="{{ player.name }}"
    class="player-profile__photo"
    loading="lazy"
  />
{% else %}
  {# Fallback to local image #}
  <img
    src="{{ player.photoURL | default('/images/players/default.png') }}"
    alt="{{ player.name }}"
    class="player-profile__photo"
    loading="lazy"
  />
{% endif %}
```

## 🔍 Where Are Your Player/Event IDs?

Your Google Sheet has these columns (as you mentioned):
- **Player** - Player name
- **Player ID** - start.gg user ID (numeric)
- **Event** - Event name
- **Event ID** - start.gg tournament ID (numeric)
- Date, Finish, Entrants, Tier, SoF

You need to map these IDs to your existing player/event data structures.

### Option A: Add IDs to Existing Data Files

Update your data files to include start.gg IDs:

**In `_data/players.js`:**
```javascript
module.exports = {
    "MenaRD": {
        "name": "MenaRD",
        "photoURL": "/images/players/menard.png",
        "startggUserId": "12345"  // ← Add this
    },
    // ...
}
```

**In `_data/events.json`:**
```json
[
  {
    "name": "Ultimate Fighting Arena 2025",
    "slug": "ultimate-fighting-arena-2025",
    "url": "https://www.start.gg/tournament/...",
    "date": "September 12-14, 2025",
    "startggTournamentId": "111222"  // ← Add this
  }
]
```

### Option B: Create a Mapping File

Create `_data/startggMappings.js`:

```javascript
module.exports = {
  playerNameToId: {
    "MenaRD": "12345",
    "Leshar": "67890",
    // ... map all players
  },
  eventSlugToId: {
    "ultimate-fighting-arena-2025": "111222",
    "roundhouse-2025": "333444",
    // ... map all events
  }
};
```

Then in templates:
```njk
{% set playerId = startggMappings.playerNameToId[player.name] %}
<img src="{{ playerId | getPlayerImage(startggImages) }}" alt="{{ player.name }}">
```

## 🎯 Recommended Approach

1. **Start small**: Update just the player profile page first
2. **Add IDs gradually**: Add `startggUserId` to top 10-20 players first
3. **Test thoroughly**: Make sure images load correctly
4. **Expand**: Once working, add more IDs and update more templates
5. **Keep fallbacks**: Always provide local images as fallback

## 📊 What Happens During Build

```
Build starts
  ↓
Read Google Sheet (CSV)
  ↓
Extract unique Player IDs + Event IDs
  ↓
Call start.gg API for each ID
  ↓
Cache results to startgg_images_cache.json
  ↓
Templates use filters to get image URLs
  ↓
Build complete
```

## ⚠️ Important Notes

1. **Rate Limits**: start.gg API has rate limits. The code caches results for 24 hours to avoid hitting limits on every build.

2. **Google Sheet Format**: Your sheet must have these exact column headers:
   - `Player ID` (numeric, e.g., "12345")
   - `Event ID` (numeric, e.g., "111222")

3. **API Token**: Make sure `.env` has `STARTGG_API_TOKEN` set (already done ✅)

4. **Build Time**: First build will be slower as it fetches all images. Subsequent builds use cache.

5. **Cache File**: Don't commit `_data/startgg_images_cache.json` to git (add to `.gitignore`)

## 🆘 Troubleshooting

**"No user found for ID: 12345"**
→ Double-check the Player ID is correct in your Google Sheet

**"Failed to fetch Google Sheet"**
→ Make sure the sheet is published to web and the URL is correct

**Images not loading**
→ Check browser console for 404 errors. Verify start.gg URLs in cache file.

**Build is slow**
→ Normal on first build. Subsequent builds use cache (fast).

## 📁 Files Created

```
C:\fgctp\
├── _data\
│   ├── lib\
│   │   └── startggApi.js          ← NEW: API helper functions
│   ├── startggImages.js            ← NEW: Data fetcher
│   └── startgg_images_cache.json   ← AUTO-GENERATED: Cached image URLs
├── _eleventy\
│   └── filters.js                  ← UPDATED: Added getPlayerImage & getEventImage filters
├── START_GG_IMAGES_SETUP.md        ← NEW: Full documentation
└── START_GG_QUICK_START.md         ← NEW: This file
```

## ✅ Next Action Items

- [ ] Step 1: Update Google Sheet URL in `_data/startggImages.js`
- [ ] Step 2: Run `npm run build` to test
- [ ] Step 3: Check `_data/startgg_images_cache.json` was created
- [ ] Step 4: Add `startggUserId` field to a few test players
- [ ] Step 5: Update one template to use the filter
- [ ] Step 6: Test in browser
- [ ] Step 7: Expand to more players and templates

## 🎉 Benefits

Once set up, you'll enjoy:
- ✅ No need to manually download/host player images
- ✅ Images auto-update when players change their start.gg profile
- ✅ Reduced hosting storage costs
- ✅ Consistent, high-quality official images
- ✅ Graceful fallbacks if API is down

---

**Questions?** Check the full documentation in `START_GG_IMAGES_SETUP.md`
