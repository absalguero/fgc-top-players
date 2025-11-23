# start.gg Image Integration Setup Guide

This guide shows you how to use images from start.gg API instead of hosting them locally.

## Setup Steps

### 1. Update Google Sheet URL

Edit `_data/startggImages.js` and replace line 59-60 with your actual Google Sheet URL:

```javascript
const googleSheetURL =
  "https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/gviz/tq?tqx=out:csv&gid=YOUR_GID";
```

**To get your sheet URL:**
1. Open your Google Sheet
2. Click "File" → "Share" → "Publish to web"
3. Select the specific sheet/tab you want
4. Choose "Comma-separated values (.csv)"
5. Copy the published URL
6. Replace `YOUR_SHEET_ID` and `YOUR_GID` with the values from your URL

### 2. Build Your Site

Run your build command (the API will fetch images during build):

```bash
npm run build
```

Or for development:

```bash
npm run dev
```

### 3. Use in Templates

The `startggImages` data is now available globally in all templates.

## Usage Examples

### Example 1: Player Profile Image with FA Icon Fallback

```njk
{# Get image from start.gg using Player ID, fallback to FA icon #}
{% set playerImageUrl = playerId | getPlayerImage(startggImages) %}
{% if playerImageUrl %}
  <img
    src="{{ playerImageUrl }}"
    alt="{{ playerName }}"
    class="player-icon"
    loading="lazy"
  />
{% else %}
  <div class="player-placeholder-icon">
    <i class="fas fa-user" aria-hidden="true"></i>
  </div>
{% endif %}
```

**Parameters:**
- `playerId` - The numeric Player ID from your Google Sheet
- `startggImages` - The global data object (automatically available)
- Returns `null` if no image found, so you can show FA icon

### Example 2: Event/Tournament Image with Fallback

```njk
{# Get image from start.gg using Event ID #}
{% set eventImageUrl = eventId | getEventImage(startggImages) %}
<img
  src="{{ eventImageUrl or '/images/events/default.png' }}"
  alt="{{ eventName }}"
  loading="lazy"
/>
```

### Example 3: Matching Your Existing Pattern

```njk
{# This matches your existing player avatar structure #}
<div class="player-cell-content {{ 'show-image' if playerImageUrl else 'show-placeholder' }}">
  {% set playerImageUrl = player.startggId | getPlayerImage(startggImages) %}
  {% if playerImageUrl %}
    <img src="{{ playerImageUrl }}" alt="{{ player.name }}" class="player-icon" loading="lazy">
  {% endif %}
  <div class="player-placeholder-icon">
    <i class="fas fa-user" aria-hidden="true"></i>
  </div>
  <span class="player-name">{{ player.name }}</span>
</div>
```

### Example 4: Using in Player Profile Template

In `profiles/player-profile-template.njk`:

```njk
{# Check if we have start.gg image #}
{% set startggImageUrl = player.startggId | getPlayerImage(startggImages) %}

<div class="profile-header__photo">
  {% if startggImageUrl %}
    {# Use start.gg image #}
    <img
      src="{{ startggImageUrl }}"
      alt="{{ player.name }}"
      class="player-icon"
      loading="lazy"
    />
  {% else %}
    {# Fallback to FA icon placeholder #}
    <div id="profile-header-placeholder" class="player-placeholder-icon">
      <i class="fas fa-user" aria-hidden="true"></i>
    </div>
  {% endif %}
</div>
```

## How It Works

1. **Build Time**: During site build, `_data/startggImages.js` runs:
   - Fetches your Google Sheet as CSV
   - Extracts all unique Player IDs and Event IDs
   - Calls start.gg GraphQL API to get image URLs for each ID
   - Caches results in `_data/startgg_images_cache.json`

2. **Template Rendering**: Templates use the `getPlayerImage` and `getEventImage` filters:
   - Filters look up the image URL from the cached data
   - Return start.gg image URL if found
   - Return `null` if not found (so template can show FA icon)

3. **Caching**: Image URLs are cached for 24 hours to avoid hitting rate limits

4. **Browser Loading**:
   - **The actual images are ONLY loaded when they appear in the HTML**
   - Images are NOT preloaded on every page
   - Only pages that use the filter and render the `<img>` tag will load images
   - Uses `loading="lazy"` for optimal performance (images load when scrolled into view)

## Image Loading Explained

**Q: Will this load images on all pages of the site?**

**A: No, images only load where you use them:**

- The `startggImages` data object is available globally (just URL strings)
- BUT the actual image files from start.gg are ONLY loaded by the browser when:
  - A template uses the filter: `{% set url = playerId | getPlayerImage(startggImages) %}`
  - AND renders an `<img>` tag with that URL: `<img src="{{ url }}">`
  - AND the user visits that page
  - AND the image scrolls into view (if using `loading="lazy"`)

**Example:**
- **Player profile page** uses filter → Image loads when user visits that profile
- **Tournament results page** uses filter → Images load for players shown
- **Home page** doesn't use filter → No images load
- **About page** doesn't use filter → No images load

**Performance Benefits:**
- ✅ Only fetch image URLs during build (not on every page load)
- ✅ Only load images on pages that actually display them
- ✅ Lazy loading delays image download until user scrolls to it
- ✅ Browser caches images across pages (if same player appears multiple times)

## Data Structure

The `startggImages` object looks like this:

```json
{
  "players": {
    "12345": "https://images.start.gg/images/user/12345/image-abc123.png",
    "67890": "https://images.start.gg/images/user/67890/image-def456.png"
  },
  "events": {
    "111222": "https://images.start.gg/images/tournament/111222/image-xyz789.png",
    "333444": "https://images.start.gg/images/tournament/333444/image-uvw012.png"
  },
  "lastUpdated": "2025-01-15T10:30:00.000Z"
}
```

## Troubleshooting

### Images not loading

1. Check that your `.env` file has `STARTGG_API_TOKEN` set
2. Verify your Google Sheet URL is correct in `_data/startggImages.js`
3. Check the build output for any API errors
4. Look at `_data/startgg_images_cache.json` to see what was fetched

### API rate limits

If you hit start.gg API rate limits:
- The cache file (`startgg_images_cache.json`) will be used automatically
- Cache duration is set to 1 day in `_data/lib/startggApi.js` (line 19)
- You can adjust the cache duration if needed

### Missing images for some players/events

- Some players/events may not have profile images on start.gg
- The filter will fall back to the local image or default image
- Check your Google Sheet to ensure Player ID and Event ID columns are correct

## Migration from Local Images

To migrate from local images to start.gg images:

1. **Add Player IDs to your data**: Make sure each player object has a `startggId` field with their numeric user ID

2. **Update templates gradually**: Start with one template (e.g., player profiles) and test

3. **Keep local images as fallback**: Don't delete local images yet - use them as fallbacks

4. **Example migration**:

```njk
{# Before #}
<img src="/images/players/{{ player.slug }}.png" alt="{{ player.name }}">

{# After (with fallback) #}
<img
  src="{{ player.startggId | getPlayerImage(startggImages, '/images/players/' + player.slug + '.png') }}"
  alt="{{ player.name }}"
>
```

## Benefits

✅ **Reduced hosting costs**: No need to store/host player and event images
✅ **Always up-to-date**: Images automatically updated when players change their profile images
✅ **Consistent quality**: Use official start.gg images
✅ **Graceful fallbacks**: Local images used if API is down or image not found
✅ **Build-time caching**: Fast builds with cached image URLs

## API Reference

### Filters

**`getPlayerImage(playerId, startggImages, fallback)`**
- `playerId` (required): Numeric user ID from start.gg
- `startggImages` (required): The global data object
- `fallback` (optional): Fallback image path (default: `/images/players/default.png`)
- Returns: Image URL string

**`getEventImage(eventId, startggImages, fallback)`**
- `eventId` (required): Numeric tournament ID from start.gg
- `startggImages` (required): The global data object
- `fallback` (optional): Fallback image path (default: `/images/events/default.png`)
- Returns: Image URL string

### Helper Functions

See `_data/lib/startggApi.js` for low-level API functions:
- `getUserImage(userId)` - Get single user image
- `getTournamentImage(tournamentId)` - Get single tournament image
- `batchGetUserImages(userIds)` - Get multiple user images
- `batchGetTournamentImages(tournamentIds)` - Get multiple tournament images

## Next Steps

1. Update `_data/startggImages.js` with your Google Sheet URL
2. Run a test build: `npm run build`
3. Check `_data/startgg_images_cache.json` to verify images were fetched
4. Update one template to use the new filters
5. Test in browser
6. Gradually migrate other templates
