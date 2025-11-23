module.exports = {
  // --- SEASON 1 & LAUNCH ROSTER ---
  "aki": {
    overview: "A poison-based setplay specialist who manipulates rhythm and space through lingering damage and control tools.",
    playstyle_summary: "A.K.I. pressures passively by forcing respect of poison, then transitions into sharp mid-range control. She wins by forcing frustration and defensive errors.",
    archetype: "Setplay / Poison",
    execution: "High",
    strengths: [
      { title: "Poison Pressure", description: "Persistent chip forces errors over time." },
      { title: "Space Control", description: "Excellent mid-range buttons and traps." },
      { title: "Corner Presence", description: "Exceptional pressure once poison lands." }
    ],
    weaknesses: [
      { title: "Defensive Options", description: "Lacks a fully invincible reversal without Super." }, // Fixed: Health is average (3)
      { title: "Tempo Reliance", description: "Struggles when pace is dictated by opponent." },
      { title: "Defensive Gaps", description: "Escape options can be scouted easily." }
    ],
    radar_stats: { Damage: 3, Health: 3, Mobility: 3, Zoning: 4, "Mix-up": 3 },
    topPlayer: null
  },

  "akuma": {
    overview: "A glass-cannon shoto whose unmatched offensive variety demands perfect control.",
    playstyle_summary: "Akuma overwhelms through aerial approach options, layered okizeme, and huge reward on clean hits. He must avoid risk due to minimal stamina.",
    archetype: "Glass Cannon / Hybrid Shoto",
    execution: "High",
    strengths: [
      { title: "Explosive Damage", description: "One opening can end a round." },
      { title: "Air Dominance", description: "Demon Flip and air fireball create complex approach paths." },
      { title: "Okizeme Depth", description: "Multiple safe-jump and pressure layers." }
    ],
    weaknesses: [
      { title: "Fragility", description: "Lowest effective health in the roster (9000)." },
      { title: "Execution", description: "Demands precision under pressure." },
      { title: "Meter Dependency", description: "Requires gauge to stabilize pressure safely." }
    ],
    radar_stats: { Damage: 5, Health: 1, Mobility: 4, Zoning: 3, "Mix-up": 5 },
    topPlayer: null
  },

  "blanka": {
    overview: "A mobile, momentum-driven character who thrives in chaos and unpredictable movement.",
    playstyle_summary: "Blanka alternates between evasive neutral and sudden offense using rolls and doll setups to create scramble situations and bait mistakes.",
    archetype: "Tricky / Mix-up",
    execution: "High",
    strengths: [
      { title: "Ambiguity", description: "Unpredictable approach angles." },
      { title: "Setplay", description: "Blanka-chan dolls enforce situational traps." },
      { title: "Anti-Projectile", description: "Low-profile tools bypass zoning." }
    ],
    weaknesses: [
      { title: "Risky Offense", description: "Unsafe on block without spacing." },
      { title: "Inconsistent Reward", description: "Requires reads to sustain pressure." },
      { title: "Corner Escape", description: "Limited reversal options under pressure." }
    ],
    radar_stats: { Damage: 3, Health: 3, Mobility: 4, Zoning: 2, "Mix-up": 5 },
    topPlayer: null
  },

  "cammy": {
    overview: "A relentless rushdown specialist who wins through speed and strike/throw layering.",
    playstyle_summary: "Cammy converts strong whiff-punish tools into knockdowns, then runs high-tempo mix. Her drive rush and dive-kick game enforce constant offense.",
    archetype: "Rushdown",
    execution: "Medium",
    strengths: [
      { title: "Speed", description: "Elite walk and dash speed for whiff punishment." },
      { title: "Corner Pressure", description: "Maintains offense with low-risk frame traps." },
      { title: "Okizeme", description: "Versatile setups after knockdowns." }
    ],
    weaknesses: [
      { title: "Drive Reliant", description: "Burnout severely limits her mix options." },
      { title: "Low Burst", description: "Requires more interactions to kill than power characters." }, // Fixed: Health is average (3)
      { title: "Limited Range", description: "Must close distance to deal real damage." }
    ],
    radar_stats: { Damage: 3, Health: 3, Mobility: 5, Zoning: 1, "Mix-up": 5 },
    topPlayer: null
  },

  "chun-li": {
    overview: "A technical all-rounder defined by superb normals and stance complexity.",
    playstyle_summary: "Chun-Li dominates footsies, converts stray hits into corner carry, and mixes opponents with stance pressure and high-low confirms.",
    archetype: "Technical All-Rounder",
    execution: "Very High",
    strengths: [
      { title: "Normals", description: "Best poke range and hit priority." },
      { title: "Anti-Air Game", description: "Multiple reliable anti-airs." },
      { title: "Adaptability", description: "Can play reactive or proactive styles." }
    ],
    weaknesses: [
      { title: "Execution Heavy", description: "Demanding stance and charge control." },
      { title: "Low Reward Pokes", description: "Many pokes lead to minor damage." },
      { title: "Slow Walk Speed", description: "Requires positioning discipline." }
    ],
    radar_stats: { Damage: 3, Health: 3, Mobility: 3, Zoning: 3, "Mix-up": 4 },
    topPlayer: null
  },

  "dee-jay": {
    overview: "A rhythm-based all-rounder using feints and delayed timing to manipulate opponent reactions.",
    playstyle_summary: "Dee Jay alternates between zoning and rushdown using charge cancels, frame traps, and fakes to control momentum.",
    archetype: "Mix-up / Rhythm",
    execution: "High",
    strengths: [
      { title: "Mind Games", description: "Feints create hesitation." },
      { title: "Corner Pressure", description: "Ambiguous strings and plus frames." },
      { title: "Versatility", description: "Strong balance of zoning and rushdown." }
    ],
    weaknesses: [
      { title: "Charge Limitation", description: "Movement tied to charge timing." },
      { title: "Risky Feints", description: "Punishable if read correctly." },
      { title: "Inconsistent Damage", description: "Depends on meter for full reward." }
    ],
    radar_stats: { Damage: 3, Health: 3, Mobility: 4, Zoning: 3, "Mix-up": 4 },
    topPlayer: null
  },

  "dhalsim": {
    overview: "A pure zoner relying on spatial denial and evasive repositioning.",
    playstyle_summary: "Dhalsim’s long limbs and teleport game create a wall of control. He wins by never letting the opponent stabilize their range.",
    archetype: "Zoner / Keep-Away",
    execution: "Very High",
    strengths: [
      { title: "Full-Screen Control", description: "Dominates long-range exchanges." },
      { title: "Teleport Utility", description: "Can escape or fake cross situations." },
      { title: "Anti-Air Options", description: "Multiple reliable anti-airs." }
    ],
    weaknesses: [
      { title: "Floaty Defense", description: "Slow jump arc makes him vulnerable to air-to-airs." }, // Fixed: Health is average (3)
      { title: "Close Combat", description: "Weak when cornered." },
      { title: "Execution", description: "High input precision requirement." }
    ],
    radar_stats: { Damage: 2, Health: 3, Mobility: 2, Zoning: 5, "Mix-up": 3 },
    topPlayer: null
  },

  "e-honda": {
    overview: "A powerhouse who breaks zoning and dominates close-range exchanges with armor and command grabs.",
    playstyle_summary: "Honda bulldozes through projectiles, leverages armored specials, and enforces throw/strike conditioning once inside.",
    archetype: "Pressure Brawler",
    execution: "Medium",
    strengths: [
      { title: "Anti-Zoning", description: "Armored Headbutt and large buttons beat projectiles." },
      { title: "Stamina", description: "High health supports attrition play." },
      { title: "Corner Damage", description: "Oicho Throw loops and frame traps." }
    ],
    weaknesses: [
      { title: "Mobility", description: "Struggles to close distance safely." },
      { title: "Predictability", description: "Linear approach patterns." },
      { title: "Punishable Armor", description: "Multi-hit moves defeat armor options." }
    ],
    radar_stats: { Damage: 4, Health: 4, Mobility: 1, Zoning: 1, "Mix-up": 3 },
    topPlayer: null
  },

  "ed": {
    overview: "A boxer built for consistent pressure with simplified execution and strong frame advantage.",
    playstyle_summary: "Ed pushes relentless offense through plus-frame buttons, Flicker jabs, and corner pressure, balancing simplicity with strong reward.",
    archetype: "Out-boxer / Control",
    execution: "Low",
    strengths: [
      { title: "Accessibility", description: "Simple inputs enable high efficiency." },
      { title: "Corner Offense", description: "Strong frame traps and Oki." },
      { title: "Space Control", description: "Flicker strings control the mid-range effectively." }
    ],
    weaknesses: [
      { title: "Defense", description: "Limited reversal options." },
      { title: "Scaling", description: "Damage lowers in extended combos." },
      { title: "Meter Usage", description: "Relies on Drive for safe pressure." }
    ],
    radar_stats: { Damage: 4, Health: 3, Mobility: 4, Zoning: 3, "Mix-up": 3 },
    topPlayer: null
  },

  "guile": {
    overview: "A disciplined zoner who controls tempo through perfect spacing and charge management.",
    playstyle_summary: "Guile wins neutral through Sonic Boom rhythm and Flash Kick deterrence, forcing mistakes from impatient opponents.",
    archetype: "Zoner / Keep-Away",
    execution: "High",
    strengths: [
      { title: "Projectile Control", description: "Sonic Boom sets neutral pace." },
      { title: "Anti-Air", description: "Flash Kick dominates jump-ins." },
      { title: "Corner Defense", description: "Wall of normals limits entry." }
    ],
    weaknesses: [
      { title: "Charge Dependency", description: "Movement constrained by charge." },
      { title: "Cornered Vulnerability", description: "Loses options when pushed back." },
      { title: "Predictability", description: "Patterns can be parried with reads." }
    ],
    radar_stats: { Damage: 4, Health: 3, Mobility: 2, Zoning: 5, "Mix-up": 1 },
    topPlayer: null
  },

  "jamie": {
    overview: "A momentum-based brawler who snowballs off drink levels, turning honest mid-range into oppressive rushdown.",
    playstyle_summary: "Jamie plays relatively honest at Level 0–1. Once stocked, his frame data, conversions, and corner carry spike hard, letting him run layered strike/throw mixups.",
    archetype: "Momentum Rushdown / Resource",
    execution: "High",
    strengths: [
      { title: "Level Snowball", description: "Drink levels dramatically upgrade his buttons." },
      { title: "Corner Carry & Oki", description: "Rekka enders push to the wall effectively." },
      { title: "Scramble Killer", description: "Fast lights and plus frames steal turns." }
    ],
    weaknesses: [
      { title: "Sober Neutral", description: "Level 0–1 buttons are noticeably weaker." },
      { title: "Defensive Gaps", description: "No true invincible reversal without meter." },
      { title: "Resource Reliance", description: "Being denied drinks flattens his win condition." }
    ],
    radar_stats: { Damage: 3, Health: 3, Mobility: 4, Zoning: 1, "Mix-up": 4 },
    topPlayer: null
  },

  "jp": {
    overview: "A trap-oriented zoner who dominates neutral with overlapping projectiles and punishes mis-timed aggression.",
    playstyle_summary: "JP controls mid-screen with torpedo zoning and command grabs that reset distance, excelling at suffocating space.",
    archetype: "Zoner / Trap Control",
    execution: "High",
    strengths: [
      { title: "Screen Control", description: "Traps and spikes dominate tempo." },
      { title: "Punish Reward", description: "Huge conversions from stray hits." },
      { title: "Safe Pressure", description: "Maintains advantage even at distance." }
    ],
    weaknesses: [
      { title: "Close Quarters", description: "Struggles when opponents stay inside." },
      { title: "Setplay Vulnerability", description: "Loses control when smothered." },
      { title: "Predictable Patterns", description: "Can be studied and counter-zoned." }
    ],
    radar_stats: { Damage: 4, Health: 3, Mobility: 2, Zoning: 5, "Mix-up": 2 },
    topPlayer: null
  },

  "juri": {
    overview: "A fast hybrid rushdown fighter who builds power via Fuha Stocks.",
    playstyle_summary: "Juri blends hit-confirm pressure with stored Fuha specials to control tempo and extend combos for strong knockdown situations.",
    archetype: "Rushdown / Stock",
    execution: "Medium",
    strengths: [
      { title: "Speed", description: "Top-tier movement and pokes." },
      { title: "Stock Utility", description: "Stored Fuha grants combo variety." },
      { title: "Corner Damage", description: "Excellent reward on confirms." }
    ],
    weaknesses: [
      { title: "Stock Reliant", description: "Neutral weak when stockless." },
      { title: "Defensive Gaps", description: "No true reversal outside OD." },
      { title: "Linear Neutral", description: "Approaches can be predictable." } // Fixed: Health is average (3)
    ],
    radar_stats: { Damage: 4, Health: 3, Mobility: 4, Zoning: 1, "Mix-up": 4 },
    topPlayer: null
  },

  "ken": {
    overview: "An aggressive shoto who corners opponents and forces high-stress guessing games.",
    playstyle_summary: "Ken skips neutral using Dragonlash and Drive Rush to enforce a strike/throw mix-up. He creates 'checkmate' scenarios in the corner with Jinrai loops.",
    archetype: "Corner Carry / Rushdown",
    execution: "Medium",
    strengths: [
      { title: "Corner Carry", description: "Best-in-class corner push from mid-screen." },
      { title: "Neutral Presence", description: "Oppressive pokes (st.HP) and fast drive rush." },
      { title: "Side Switches", description: "Can escape the corner and reverse pressure easily." }
    ],
    weaknesses: [
      { title: "Linear Approaches", description: "Key approach tools are susceptible to Perfect Parry." },
      { title: "Commitment", description: "Heavy specials leave him vulnerable if guessed right." },
      { title: "Stubby Lows", description: "Crouching MK has average range." }
    ],
    radar_stats: { Damage: 4, Health: 3, Mobility: 5, Zoning: 3, "Mix-up": 4 },
    topPlayer: null
  },

  "kimberly": {
    overview: "A deceptive rushdown fighter who uses mobility and misdirection to overwhelm.",
    playstyle_summary: "Kimberly leverages dash cancels, spray can setups, and teleports for high-tempo, ambiguous offense.",
    archetype: "Tricky Rushdown",
    execution: "High",
    strengths: [
      { title: "Speed", description: "Exceptional ground and air mobility." },
      { title: "Ambiguity", description: "Teleport and bombs create chaos." },
      { title: "Corner Snowball", description: "One knockdown leads to relentless oki." }
    ],
    weaknesses: [
      { title: "Low Damage", description: "Must win neutral multiple times to kill." },
      { title: "Defensive Options", description: "Lacks a fully invulnerable reversal without Super." }, // Fixed: Health is average (3)
      { title: "Punishability", description: "Unsafe moves if mis-timed." }
    ],
    radar_stats: { Damage: 2, Health: 3, Mobility: 5, Zoning: 1, "Mix-up": 5 },
    topPlayer: null
  },

  "lily": {
    overview: "A stock-based grappler who powers up through Wind Stocks to enhance range and pressure.",
    playstyle_summary: "Lily builds stocks, then uses Condor Spire and Wind-powered specials for armored entries and mixups.",
    archetype: "Stock Mix-up",
    execution: "Low",
    strengths: [
      { title: "Burst Damage", description: "Top-tier damage output with Wind Stocks." },
      { title: "Command Grab", description: "Dangerous once in range." },
      { title: "Neutral Options", description: "Can vary approach timing with dash and jump." }
    ],
    weaknesses: [
      { title: "Stock Dependence", description: "Weaker when resource-empty." },
      { title: "Low Speed", description: "Slower neutral game." },
      { title: "Defensive Struggles", description: "Few tools under pressure." }
    ],
    radar_stats: { Damage: 4, Health: 3, Mobility: 3, Zoning: 2, "Mix-up": 4 },
    topPlayer: null
  },

  "luke": {
    overview: "The textbook 'perfect' soldier with tools for every range.",
    playstyle_summary: "Luke plays a compact, reactive game. He punishes whiffs with high-damage target combos and controls space with high-velocity projectiles.",
    archetype: "All-Rounder / Footsies",
    execution: "Medium",
    strengths: [
      { title: "Projectile Speed", description: "Sandblast punishes opponent startups from range." },
      { title: "Anti-Air", description: "Rising Uppercut is a distinct, reliable anti-air." },
      { title: "Damage Consistency", description: "Charge mechanics reward patience." }
    ],
    weaknesses: [
      { title: "Short Range Pokes", description: "Loses to long-range pokes (e.g., Chun-Li, Dhalsim)." },
      { title: "Honest Neutral", description: "Lacks 'gimmicks' to skip neutral easily." },
      { title: "Super Utility", description: "Level 1 Super has very short range." }
    ],
    radar_stats: { Damage: 4, Health: 3, Mobility: 3, Zoning: 4, "Mix-up": 3 },
    topPlayer: null
  },

  "manon": {
    overview: "A graceful hybrid grappler who builds Medal levels to enhance command grab potency.",
    playstyle_summary: "Manon’s strength escalates as she gains Medals, forcing the opponent to make perfect defensive calls.",
    archetype: "Hybrid Grappler",
    execution: "Low",
    strengths: [
      { title: "Medal Scaling", description: "Damage and pressure increase per Medal." },
      { title: "Whiff Punish", description: "Excellent long-range buttons." },
      { title: "Strike/Throw Game", description: "Lethal once Medals stack." }
    ],
    weaknesses: [
      { title: "Poor Defense", description: "Lacks a true invulnerable reversal without super." },
      { title: "Slow Start", description: "Low reward before building Medals." },
      { title: "Mobility", description: "Slower dash and approach." }
    ],
    radar_stats: { Damage: 3, Health: 3, Mobility: 2, Zoning: 2, "Mix-up": 4 },
    topPlayer: null
  },

  "marisa": {
    overview: "A slow but devastating bruiser who dominates trades and corner situations.",
    playstyle_summary: "Marisa uses armored charge moves and high-damage punishes to impose fear and corner carry.",
    archetype: "Power / Brawler",
    execution: "Low",
    strengths: [
      { title: "Armor Tools", description: "Can challenge pressure effectively." },
      { title: "Burst Damage", description: "Top 3 in raw output." },
      { title: "Corner Pressure", description: "Near checkmate with Drive Rush." }
    ],
    weaknesses: [
      { title: "Mobility", description: "Easily zoned or kited." },
      { title: "Predictable Entry", description: "Armored charges can be baited." },
      { title: "Execution", description: "Timing-sensitive confirms." }
    ],
    radar_stats: { Damage: 5, Health: 4, Mobility: 1, Zoning: 1, "Mix-up": 2 },
    topPlayer: null
  },

  "rashid": {
    overview: "A vortex-heavy mobility fighter who breaks conventional spacing through wind-enhanced movement.",
    playstyle_summary: "Rashid controls aerial and ground tempo through Whirlwind Shot and dive options, forcing unstable neutral.",
    archetype: "Vortex / Mix-up",
    execution: "High",
    strengths: [
      { title: "Mobility", description: "Elite movement in all ranges." },
      { title: "Okizeme", description: "Continuous looping pressure after knockdown." },
      { title: "Scramble Strength", description: "Excels in chaos and resets." }
    ],
    weaknesses: [
      { title: "Stubby Normals", description: "Range is limited without wind enhancement." }, // Fixed: Health is average (3)
      { title: "Damage Scaling", description: "Requires meter for strong conversions." },
      { title: "Execution Demand", description: "Complex aerial setups." }
    ],
    radar_stats: { Damage: 3, Health: 3, Mobility: 5, Zoning: 3, "Mix-up": 5 },
    topPlayer: null
  },

  "ryu": {
    overview: "A fundamentals-based shoto built on stable zoning and frame control.",
    playstyle_summary: "Ryu plays pure Street Fighter: footsies, spacing, and consistent reward through Drive Rush confirms and corner fireball control.",
    archetype: "Balanced Shoto",
    execution: "Medium",
    strengths: [
      { title: "Consistency", description: "Solid at all ranges." },
      { title: "Zoning", description: "Hadoken controls pace." },
      { title: "Footsies", description: "Reliable whiff punish tools." }
    ],
    weaknesses: [
      { title: "Limited Mix-up", description: "Few ambiguous options." },
      { title: "Meter Dependence", description: "Needs Drive Rush to extend damage." },
      { title: "Predictable Neutral", description: "Straightforward tools struggle to check erratic movement or unconventional approach angles." }
    ],
    radar_stats: { Damage: 3, Health: 3, Mobility: 3, Zoning: 3, "Mix-up": 2 },
    topPlayer: null
  },

  "zangief": {
    overview: "A command grab specialist who enforces fear through spacing control and immense reward per hit.",
    playstyle_summary: "Zangief corners opponents using Drive Rush armor, SPD threat, and high stun potential — one mistake can end the round.",
    archetype: "Grappler",
    execution: "Medium",
    strengths: [
      { title: "Reward", description: "Highest damage from single reads." },
      { title: "Durability", description: "Takes punishment and still wins." },
      { title: "Pressure", description: "Corner vortex with command grabs." }
    ],
    weaknesses: [
      { title: "Mobility", description: "Slow approach and jump arc." },
      { title: "Zoning", description: "Loses to strong projectile play." },
      { title: "Whiff Risk", description: "SPD misses are highly punishable." }
    ],
    radar_stats: { Damage: 5, Health: 5, Mobility: 1, Zoning: 1, "Mix-up": 4 },
    topPlayer: null
  },

  // --- SEASON 2 ADDITIONS ---
  "m-bison": {
    overview: "A powerhouse with oppressive plus-frames, teleport pressure, and corner lockdown.",
    playstyle_summary: "M. Bison overwhelms opponents with frame traps, Psycho Impact pressure, and forced defense loops.",
    archetype: "Pressure / Dictator",
    execution: "Medium",
    strengths: [
      { title: "Frame Advantage", description: "Dominates once in block range." },
      { title: "Teleport Mix", description: "Ambiguous movement confuses defense." },
      { title: "Corner Traps", description: "Extremely strong against passive play." }
    ],
    weaknesses: [
      { title: "Mobility", description: "Slow walk speed, relies on Drive Rush." },
      { title: "Predictable Strings", description: "Pressure can be parried if read." },
      { title: "No True Reversal", description: "Relies on meter to escape." }
    ],
    radar_stats: { Damage: 4, Health: 3, Mobility: 3, Zoning: 2, "Mix-up": 5 },
    topPlayer: null
  },

  "terry": {
    overview: "A legendary hungry wolf who adapts to any situation with powerful lunging specials.",
    playstyle_summary: "Terry uses Burn Knuckle to punish from mid-range and Power Dunk to close out combos. He is an aggressive all-rounder who thrives on meter usage.",
    archetype: "All-Rounder / Aggressive",
    execution: "Medium",
    strengths: [
      { title: "Neutral Skipping", description: "Burn Knuckle and Crack Shoot close gaps instantly." },
      { title: "Damage", description: "High damage output when spending meter." },
      { title: "Anti-Air", description: "Rising Tackle is a strong defensive tool." }
    ],
    weaknesses: [
      { title: "Meter Hungry", description: "Needs Drive Gauge to be truly threatening." },
      { title: "Linearity", description: "Specials are unsafe if spaced poorly." },
      { title: "Recovery", description: "Whiffed specials are easily punished." }
    ],
    radar_stats: { Damage: 4, Health: 3, Mobility: 3, Zoning: 3, "Mix-up": 3 },
    topPlayer: null
  },

  "mai": {
    overview: "A high-mobility zoning specialist who uses fans and aerial movement to control the screen.",
    playstyle_summary: "Mai frustrates opponents with fan toss zoning and superior air mobility, frustrating grapplers and shotos alike before closing in for high-damage combos.",
    archetype: "Zoning / Mobility",
    execution: "Medium",
    strengths: [
      { title: "Air Mobility", description: "Musasabi no Mai changes air trajectory." },
      { title: "Screen Control", description: "Kachosen fans dominate horizontal space." },
      { title: "Reach", description: "Excellent long-range normals." }
    ],
    weaknesses: [
      { title: "Defensive Gaps", description: "Struggles when pressured in the corner." }, // Fixed: Health is average (3)
      { title: "Anti-Air Susceptibility", description: "Floaty jumps can be reacted to." },
      { title: "Close Range Defense", description: "Reliance on mobility to escape." }
    ],
    radar_stats: { Damage: 3, Health: 3, Mobility: 5, Zoning: 4, "Mix-up": 3 },
    topPlayer: null
  },

  "elena": {
    overview: "A mobile footsie character defined by long-range normals and unique healing potential.",
    playstyle_summary: "Elena frustrates through evasive movement and low-risk pokes, then sustains life with her Super arts in drawn-out matches.",
    archetype: "Footsie / Sustain",
    execution: "Medium",
    strengths: [
      { title: "Range", description: "Long reach on key pokes and target strings." },
      { title: "Evasion", description: "High mobility and awkward hurtbox." },
      { title: "Healing", description: "Super Art allows life recovery." }
    ],
    weaknesses: [
      { title: "Low Damage", description: "Struggles to snowball momentum." },
      { title: "Limited Defense", description: "Few reversal options." },
      { title: "Super Risk", description: "Healing punishable if telegraphed." }
    ],
    radar_stats: { Damage: 2, Health: 3, Mobility: 4, Zoning: 2, "Mix-up": 3 },
    topPlayer: null
  },

  // --- SPECIAL / REQUESTED ADDITIONS ---
  "c-viper": {
    overview: "An explosive, high-execution rushdown character who thrives on relentless offense and aerial feints.",
    playstyle_summary: "C. Viper is a momentum monster who leverages feints, seismos, and burn kick mix to overwhelm opponents. She rewards mechanical mastery with oppressive pressure sequences.",
    archetype: "Technical Rushdown / Mix-up",
    execution: "Very High",
    strengths: [
      { title: "Okizeme", description: "Top-tier knockdown pressure with ambiguous setups." },
      { title: "Feint Cancels", description: "Thunder Knuckle feints create safe pressure and frame traps." },
      { title: "Aerial Approach", description: "Burn Kick cross-ups and jump arcs punish static defense." }
    ],
    weaknesses: [
      { title: "Defense", description: "Lacks reliable meterless reversal options." },
      { title: "Execution", description: "Requires advanced cancel precision and manual timing." },
      { title: "Neutral Risk", description: "Struggles to establish presence against strong zoners." }
    ],
    radar_stats: { Damage: 5, Health: 3, Mobility: 5, Zoning: 1, "Mix-up": 5 },
    topPlayer: null
  },

  "sagat": {
    overview: "The Emperor of Muay Thai who controls the screen with unrivaled projectile speed and reach.",
    playstyle_summary: "Sagat enforces a strict zoning game with High and Low Tiger Shots, punishing any jump attempt with a devastating Tiger Uppercut.",
    archetype: "Zoner / King",
    execution: "Medium",
    strengths: [
      { title: "Projectile Dominance", description: "Fastest recovery fireballs in the game." },
      { title: "Anti-Air", description: "Tiger Uppercut covers huge vertical space." },
      { title: "Reach", description: "Massive limbs control mid-range effortlessly." }
    ],
    weaknesses: [
      { title: "Mobility", description: "Slow walk speed and heavy jump arc." },
      { title: "Big Hurtbox", description: "Easier to combo against and harder to escape pressure." },
      { title: "Close Range", description: "Struggles against fast, small rushdown characters." }
    ],
    radar_stats: { Damage: 5, Health: 4, Mobility: 1, Zoning: 5, "Mix-up": 2 },
    topPlayer: null
  }
};