// /_data/allUpcomingTournaments.js

// This file defines upcoming tournaments that are not yet in the historical archive.
// Once a tournament is over, its data should be moved to upcoming-tournaments_archive.json

const archive = require("./upcoming-tournaments_archive.json");

// Define your new or active tournaments directly in this object.
const newTournaments = {
  "umad-2025": {
    name: "Ultimate Montreal Airdashers 2025",
    dates: "Sep 19-21, 2025",
    location: "8 Rue Queen, Montréal, QC H3C 1X7, Canada",
    url: "https://www.start.gg/tournament/umad-2025/details",
    tier: "B",
    prizes: "TBA",
    game: "Street Fighter 6",
    slug: "umad-2025",
    streamLink: "https://www.twitch.tv/woolieversus",
    scheduleLink: "https://x.com/WoolieWoolz/status/1969113618403787067",
    description: `UMAD 2025 is set to be one of the year’s most exciting fighting game tournaments, bringing together players from all over the competitive FGC to battle for glory, recognition, and prizes. Known for its high-energy atmosphere and community-driven spirit, UMAD has built a reputation as a premier esports event where both veteran competitors and rising stars get the chance to showcase their skills on the big stage.

Fans can expect fast-paced matches, unforgettable comebacks, and the kind of hype that only a top-tier fighting game event can deliver. With multiple games featured, a strong lineup of players, and an environment designed to celebrate the culture of fighting games, UMAD 2025 will be more than just a tournament—it will be a gathering place for the FGC to connect, compete, and create lasting memories.

For those looking to take their skills to the next level, UMAD 2025 is the perfect stage to test strategies, gain experience against high-level talent, and make a name within the competitive scene. Spectators and participants alike will enjoy the excitement of live competition, the energy of passionate fans, and the opportunity to be part of one of the standout events of the esports calendar.

If you are a fighting game fan, competitor, or community supporter, UMAD 2025 is an event you won’t want to miss. Register today, train hard, and get ready to join an experience that embodies everything the Fighting Game Community stands for.`,
    venueName: "8 Queen",
    "notablePlayers": [
  "FluxWaveZ", "googy", "Methodcobra"
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
  },
  "evo-france-2025": {
    name: "Evo France 2025",
    dates: "Oct 10-12, 2025",
    location: "Parv. de l'Europe, 06000 Nice, France",
    url: "https://evo.gg/events/2025-france",
    tier: "S+",
    prizes: "€100,000",
    game: "Street Fighter 6",
    slug: "evo-france-2025",
    streamLink: "",
    scheduleLink: "",
    description: `EVO France 2025 is shaping up to be a landmark event in the history of competitive fighting games, as it marks the first EVO event held in Europe. Set for October 10-12, 2025 at the Palais des Expositions - Nice Acropolis, this three-day festival will gather the world's top FGC talent alongside a passionate fanbase to compete across seven headline titles: Street Fighter 6, Tekken 8, Guilty Gear -Strive-, Dragon Ball FighterZ, Granblue Fantasy Versus: Rising, Fatal Fury: City of the Wolves, and Hunter×Hunter Nen×Impact.

EVO France 2025 will offer one of the most intense and prestige-filled brackets yet. Entrants can expect fierce matchups as longtime champions and emerging stars alike battle to prove who truly sits at the pinnacle of SF6. With a strong prize pool totaling 100 000 € across the seven main tournaments, every match carries weight—not just for glory or ranking, but for a meaningful share of rewards.

What makes EVO France extra special is the full Main Stage Finals for each of the seven featured titles being held in the same Palais des Expositions - Nice Acropolis venue, providing unified, high-impact moments for spectators and competitors alike. Imagine Top 8 SF6 sets with high stakes, high energy, crowd support, and all eyes watching: comebacks, clutch reads, character mastery, and the evolving meta on full display.

This event is more than just competition—it’s a celebration of fighting game culture in Europe, from free-play sessions to meetups, and a chance for fans and players to connect in person. If you follow SF6 or the broader EVO series, EVO France 2025 promises must-see gameplay, historic potential, and a chance for legends to be made.`,
    venueName: "Palais des Expositions - Nice Acropolis"
  },
  "kuaishou-fightclub-championship-vi-chengdu": {
    name: "Kuaishou Fightclub Championship VI · Chengdu",
    dates: "Oct 31-Nov 2, 2025",
    location: "No. 8, Section 4, Renmin South Road, Wuhou District, Chengdu, Sichuan, China Postal Code: 610041",
    url: "https://www.start.gg/tournament/vi-kuaishou-fightclub-championship-vi-chengdu/details",
    tier: "S",
    prizes: "￥71,000",
    game: "Street Fighter 6",
    slug: "kuaishou-fightclub-championship-vi-chengdu",
    streamLink: "",
    scheduleLink: "",
    description: `Get ready for the KUAISHOU FIGHTCLUB CHAMPIONSHIP VI · CHENGDU! This premier FGC event, also known as 快手王者之战VI, takes place from October 31st to November 2nd, 2025, at the prestigious Sichuan Gymnasium in Chengdu, China. Witness top-tier competition as fighters clash in the main event, a Street Fighter 6 CPT Premier. Whether you're a competitor or a fan, this is a must-attend tournament for the global fighting game community. Don't miss out on the action!`,
    venueName: "Sichuan Gymnasium"
  }
};

// Merge the archive with your new tournaments to create a single data source
module.exports = {
  ...archive,
  ...newTournaments,
};