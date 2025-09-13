// _data/allUpcomingTournaments.js (After)

const archive = require("./upcoming-tournaments_archive.json");

// ✅ Define your new or active tournaments directly in this object.
const newTournaments = {
  "ultimate-fighting-arena-2025-3": {
    name: "Ultimate Fighting Arena 2025",
    dates: "Sep 12-14, 2025",
    location: "87 Avenue des Magasins Généraux, 93300 Aubervilliers, France",
    url: "https://www.ufa.gg/",
    tier: "S",
    prizes: "€9,324 Pot",
    game: "Street Fighter 6",
    slug: "ultimate-fighting-arena-2025-3",
    streamLink: "https://www.twitch.tv/capcomfighters",
    scheduleLink: "https://x.com/UFA_Gaming/status/1966184965449842863",
    description: `Ultimate Fighting Arena (UFA) is Europe’s biggest festival dedicated to fighting games, held over three days from September 12-14, 2025 at Docks de Paris, Aubervilliers, Grand Paris.

At UFA, top players, fans, and newcomers come together not only to compete in high-stakes tournaments, but also to dive into a full cultural celebration of the fighting game community. Attendees can play in the Arcade Zone, enjoy world-class exhibitions, shop at merchandise booths, sample food from a variety of food trucks, and explore the artist alley.

UFA 2025 is organized by Gozulting together with community partners and powered by a passionate volunteer base.`,
    venueName: "Docks de Paris",
    notablePlayers: [
  "Daigo Umehara",
  "Tokido",
  "GO1",
  "Punk",
  "NuckleDu",
  "Riddles",
  "Problem X",
  "Luffy",
  "Phenom",
  "Itabashi Zangief",
  "Higuchi",
  "EndingWalker",
  "Oil King",
  "Blaz",
  "Ryan Hart"
]
  },
  "roundhouse-2025": {
    name: "Roundhouse 2025",
    dates: "Sep 26-28, 2025",
    location: "1400 Milwaukee Ave, Glenview, IL 60025, USA",
    url: "http://lowkickesports.com/",
    tier: "B",
    prizes: "$1,000 Pot Bonus",
    game: "Street Fighter 6",
    slug: "roundhouse-2025",
    streamLink: "",
    scheduleLink: "",
    description: `Get ready for Roundhouse 2025, the Midwest’s premier fighting game showdown. From September 26-28, 2025, competitors, fans, and newcomers converge on Chicago’s Glenview area for three full days of tournaments, side-events, exhibitions, and nonstop action.

Held in the luxurious Renaissance Chicago Glenview Suites Hotel—just 20 minutes from O’Hare with free parking, EV charging, and transit access via the Jefferson Park CTA hub—Roundhouse 2025 delivers premium fighting game culture in comfort.

Highlights include:

Over 20 official tournaments, including the return of MIDBEST and TAG exhibitions.

24-hour venue access so that casuals, side tournaments, and top-tier matchups are always on.

Spectator and competitor badges with early, standard, and late registration tiers.

Community favorite side events (Melty Blood, Skullgirls, Rivals of Aether, and more) plus vendor booths, food options, and a walkable scene.`,
    venueName: "Renaissance Chicago Glenview Suites Hotel"
  }
};

// Merge the archive with your new tournaments
module.exports = {
  ...archive,
  ...newTournaments,
};
