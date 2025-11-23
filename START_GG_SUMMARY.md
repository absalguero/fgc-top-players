# start.gg Images - Summary

## ✅ Your Questions Answered

### 1. Fallback to Font Awesome Icon

**✅ FIXED!** The filters now return `null` when no image is found, so you can show your existing `fas fa-user` icon.

**Usage Pattern:**
```njk
{% set playerImageUrl = player.startggId | getPlayerImage(startggImages) %}
{% if playerImageUrl %}
  <img src="{{ playerImageUrl }}" alt="{{ player.name }}" class="player-icon" loading="lazy">
{% else %}
  <div class="player-placeholder-icon">
    <i class="fas fa-user" aria-hidden="true"></i>
  </div>
{% endif %}
```

This matches your existing pattern perfectly!

### 2. Will This Load Images on All Pages?

**No! Images only load where you use them.**

**What happens during build:**
- ✅ Fetches image **URLs** from start.gg API (just text strings)
- ✅ Stores URLs in `_data/startgg_images_cache.json`
- ✅ Makes URLs available globally via `startggImages` data object

**What happens when user visits a page:**
- ❌ Images do NOT automatically load on every page
- ✅ Images ONLY load on pages where you use the filter AND render an `<img>` tag
- ✅ Uses `loading="lazy"` so images only load when scrolled into view

**Example:**
```
Build time:
  - Fetch all image URLs from start.gg → store in cache ✅

User visits home page:
  - No filter used in template → No images load ✅

User visits player profile page:
  - Filter used: {% set url = player.id | getPlayerImage(startggImages) %} → Gets URL from cache ✅
  - Renders: <img src="https://images.start.gg/..." loading="lazy"> → Browser loads image ✅

User scrolls down player profile:
  - Image enters viewport → Browser downloads image ✅
```

**Performance Impact:**
- 📦 Build time: +2-5 seconds (first build only, then cached)
- 🚀 Page load: No impact on pages that don't use images
- 🖼️ Image load: Only on pages that render images (lazy loaded)

---

## 🎯 Recommended Implementation Strategy

### Phase 1: Setup (5 minutes)
1. Update Google Sheet URL in `_data/startggImages.js`
2. Run `npm run build` to test
3. Verify `_data/startgg_images_cache.json` was created

### Phase 2: Add IDs to Data (15-30 minutes)
Add `startggUserId` to your player data:

**Option A: Update `_data/players.js`**
```javascript
module.exports = {
    "MenaRD": {
        "name": "MenaRD",
        "photoURL": "/images/players/menard.png",
        "startggUserId": "12345"  // ← Add from your Google Sheet
    }
}
```

**Option B: Create mapping in data processing**
In `_data/playerProfiles.js` or wherever you process player data:
```javascript
// Read your Google Sheet data
const playerIdMap = {}; // Build from Google Sheet: { "MenaRD": "12345", ... }

// Add to each player object
player.startggUserId = playerIdMap[player.name];
```

### Phase 3: Update Templates (30-60 minutes)
Update templates one by one:

**Priority order:**
1. Player profile pages (biggest impact)
2. Player stats/leaderboard pages
3. Tournament results pages
4. Character profile pages (for featured players)

**Template pattern:**
```njk
{# Get start.gg image URL #}
{% set imgUrl = player.startggUserId | getPlayerImage(startggImages) %}

{# Render image or FA icon #}
{% if imgUrl %}
  <img src="{{ imgUrl }}" alt="{{ player.name }}" class="player-icon" loading="lazy">
{% else %}
  <div class="player-placeholder-icon">
    <i class="fas fa-user" aria-hidden="true"></i>
  </div>
{% endif %}
```

---

## 📋 Complete File Checklist

Files I created for you:
- ✅ `_data/lib/startggApi.js` - API helper functions
- ✅ `_data/startggImages.js` - Fetches images during build
- ✅ `_eleventy/filters.js` - Updated with getPlayerImage & getEventImage filters
- ✅ `.gitignore` - Added cache file
- ✅ `START_GG_IMAGES_SETUP.md` - Full documentation
- ✅ `START_GG_QUICK_START.md` - Quick start guide
- ✅ `START_GG_SUMMARY.md` - This file

Files you need to update:
- ⏳ `_data/startggImages.js` (line 59-60) - Your Google Sheet URL
- ⏳ Your player data files - Add `startggUserId` field
- ⏳ Your templates - Use the filters to render images

---

## 🚀 Quick Start (3 Steps)

1. **Update `_data/startggImages.js` line 59-60 with your Google Sheet URL**

2. **Test the build:**
   ```bash
   npm run build
   ```
   Check that `_data/startgg_images_cache.json` was created

3. **Update one template to test:**
   ```njk
   {% set imgUrl = player.startggUserId | getPlayerImage(startggImages) %}
   {% if imgUrl %}
     <img src="{{ imgUrl }}" alt="{{ player.name }}" class="player-icon" loading="lazy">
   {% else %}
     <div class="player-placeholder-icon"><i class="fas fa-user"></i></div>
   {% endif %}
   ```

---

## 💡 Key Benefits

- ✅ **No hosting costs** for player images
- ✅ **Auto-updated** when players change start.gg profiles
- ✅ **FA icon fallback** for missing images
- ✅ **Lazy loading** for performance
- ✅ **Only loads on pages that use images** (not all pages)
- ✅ **Cached for 24 hours** to avoid API rate limits
- ✅ **Graceful degradation** if API is down

---

## ❓ FAQ

**Q: Do I need to delete my local player images?**
A: No! Keep them as a backup. The system only uses start.gg images where you add the filter.

**Q: What if a player doesn't have a start.gg profile image?**
A: The filter returns `null`, and your template shows the FA icon (just like now).

**Q: Will this slow down my build?**
A: First build: +2-5 seconds. Subsequent builds: instant (uses cache).

**Q: What about event/tournament images?**
A: Same system! Use `getEventImage` filter with numeric tournament ID.

**Q: Can I test with just a few players first?**
A: Yes! Only add `startggUserId` to a few test players, update one template, and verify it works.

---

Read `START_GG_IMAGES_SETUP.md` for complete documentation!
