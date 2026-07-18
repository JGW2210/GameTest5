// Card, enemy, wave and dialogue definitions for the prototype battle.

// Unit archetypes:
//  'palm'   (Open Palm)  — defensive. Never acts on its own; only moves when the
//                          player's telekinesis moves it.
//  'fist'   (Closed Fist) — attacker. At end of turn advances one tile toward the
//                          enemy, unless an enemy shares its tile, then it attacks.
//  'sign'   (Hand Sign)  — magic. Ranged 2-5 tiles along its path. Can never be
//                          moved, even by telekinesis (it would sever its
//                          connection to Kinaeto).
//  'object' (Relic)      — inert obstacle. Blocks enemy advance; telekinesis can
//                          hurl it around freely.

export const CARDS = {
  zealot: {
    key: 'zealot',
    name: 'Torchbearer Zealot',
    type: 'fist',
    cost: 1,
    hp: 3,
    atk: 2,
    rage: true,
    onDeath: 'ember',
    cry: 'bolt',
    desc: 'Arrives: 1 dmg to nearest foe on its path. RAGE: +1 atk each attack. Dies burning its killer for 1.',
    flavor: 'The flame goes where the hand wills.',
  },
  warden: {
    key: 'warden',
    name: 'Shrouded Warden',
    type: 'palm',
    cost: 1,
    hp: 6,
    atk: 1,
    armor: 1,
    cry: 'ward',
    desc: 'Arrives with WARD 2. ARMOR 1. Holds its tile and strikes back.',
    flavor: 'An open palm refuses nothing, and yields nothing.',
  },
  acolyte: {
    key: 'acolyte',
    name: 'Whisper Acolyte',
    type: 'sign',
    cost: 2,
    hp: 2,
    atk: 2,
    range: 3,
    cry: 'draw',
    desc: 'Arrives: draw a card. Range 3 along its path. Immovable.',
    flavor: 'Their fingers spell words the church burned.',
  },
  fleet: {
    key: 'fleet',
    name: 'Fleet Cultist',
    type: 'fist',
    fast: true,
    cost: 2,
    hp: 2,
    atk: 2,
    rage: true,
    cry: 'advance',
    desc: 'Fast placement, arrives already advancing. RAGE: +1 atk each attack.',
    flavor: 'Bare feet know the cave better than boots know the road.',
  },
  eye: {
    key: 'eye',
    name: 'Eye of Kinaeto',
    type: 'sign',
    cost: 3,
    hp: 3,
    atk: 3,
    range: 5,
    sweep: true,
    desc: 'SWEEP: strikes every foe on its path within 5. Immovable.',
    flavor: 'It blinked once, and a cathedral went dark.',
  },
  shrine: {
    key: 'shrine',
    name: 'Braced Stone',
    type: 'object',
    cost: 1,
    hp: 8,
    atk: 0,
    size: 2,
    desc: 'Fills most of a tile (size 2). Telekinesis may hurl it anywhere.',
    flavor: 'Just a rock. Kinaeto is fond of rocks.',
  },

  // Kinaetic Rites — cast through Kinaeto himself. They cost no Impetus but
  // consume your single Kinaetic focus for the turn.
  crush: {
    key: 'crush',
    name: 'Kinaetic Crush',
    type: 'tk',
    power: 'crush',
    cost: 0,
    desc: 'The hand clenches: 3 damage to any unit. Uses your Kinaetic focus.',
    flavor: 'Somewhere beyond the veil, knuckles whiten.',
  },
  trip: {
    key: 'trip',
    name: 'Kinaetic Trip',
    type: 'tk',
    power: 'trip',
    cost: 0,
    desc: 'Sweep the legs: a unit skips its next action. Uses your Kinaetic focus.',
    flavor: 'Even a saint is mostly ankles.',
  },
  beckon: {
    key: 'beckon',
    name: "Kinaeto's Beckoning",
    type: 'tk',
    power: 'beckon',
    cost: 0,
    desc: 'The hand beckons: draw 3 cards. Uses your Kinaetic focus.',
    flavor: 'Come, it gestures. Bring friends.',
  },
};

// Starting deck for the prototype run (5 to open, 3 per turn, reshuffles).
export const STARTER_DECK = [
  'zealot', 'zealot', 'zealot', 'zealot',
  'warden', 'warden', 'warden',
  'acolyte', 'acolyte',
  'fleet', 'fleet',
  'eye',
  'shrine', 'shrine',
  'crush', 'crush',
  'trip', 'trip',
  'beckon', 'beckon',
];

export const ENEMIES = {
  footman: {
    key: 'footman',
    name: 'Crusader Footman',
    kind: 'melee',
    hp: 4,
    atk: 2,
    desc: 'Advances 1 tile. Attacks defenders in its way.',
  },
  hound: {
    key: 'hound',
    name: 'Zealous Hound',
    kind: 'melee',
    speed: 2,
    hp: 2,
    atk: 1,
    desc: 'Advances 2 tiles per turn.',
  },
  crossbow: {
    key: 'crossbow',
    name: 'Church Crossbowman',
    kind: 'ranged',
    range: 3,
    hp: 2,
    atk: 2,
    desc: 'Shoots the nearest cultist within 3 tiles.',
  },
  shieldbearer: {
    key: 'shieldbearer',
    name: 'Shield Bearer',
    kind: 'melee',
    slow: true,
    armor: 1,
    hp: 8,
    atk: 1,
    desc: 'ARMOR 1. Advances every other turn.',
  },
  boss: {
    key: 'boss',
    name: 'Saint-Commander Aurel',
    kind: 'melee',
    boss: true,
    armor: 1,
    size: 3,
    hp: 26,
    atk: 4,
    desc: 'ARMOR 1. Too heavy to Move or Push. Crush is halved. Every 2nd turn: Consecration — 2 damage to every cultist on his path.',
  },
  inquisitor: {
    key: 'inquisitor',
    name: 'Grand Inquisitor Sarethiel',
    kind: 'melee',
    boss: true,
    armor: 3,
    size: 3,
    hp: 60,
    atk: 9,
    desc: 'The church made flesh. His Judgement stuns every faithful soul at once and cracks stone itself.',
  },
};

// The congregation standing before Kinaeto when the tutorial sermon begins.
export const SERMON_FLOCK = [
  { key: 'zealot', path: 0, row: 1 },
  { key: 'warden', path: 1, row: 1 },
  { key: 'zealot', path: 2, row: 1 },
  { key: 'acolyte', path: 1, row: 2 },
];

// Fixed-order tutorial deck (drawn front-to-back, never shuffled) so every
// guided step finds the card it teaches with. Opening hand of 5: zealot,
// warden, fleet, crush, beckon.
export const TUTORIAL_DECK = [
  'zealot', 'warden', 'fleet', 'crush', 'beckon',
  'eye', 'zealot', 'warden',
  'trip', 'zealot', 'shrine',
  'acolyte', 'crush', 'zealot', 'warden', 'beckon',
];

// The tutorial — "The First Night". Crusaders crash the sermon immediately
// (the first wave is force-spawned by the tutorial script, never by timer),
// a second wave arrives mid-lesson, and the Grand Inquisitor's arrival is
// scripted: the battle cannot be won, only understood.
export const TUTORIAL_BATTLE = {
  name: 'The First Night',
  obeliskHp: 20,
  noVictory: true,
  waves: [
    {
      warnAtEnd: -1, // force-spawned mid-sermon by the tutorial script
      spawnAtEnd: -1,
      spawns: [
        { path: 0, enemy: 'footman' },
        { path: 1, enemy: 'footman' },
      ],
    },
    {
      warnAtEnd: 3,
      spawnAtEnd: 4,
      spawns: [
        { path: 1, enemy: 'hound' },
        { path: 2, enemy: 'footman' },
        { path: 0, enemy: 'crossbow' },
      ],
    },
  ],
  doomAfterTurn: 5, // at the end of this turn the Inquisitor ends the lesson
  doomWave: { spawns: [{ path: 1, enemy: 'inquisitor' }] },
};

// Battle 1 — "The Lower Gate".
// Wave timing per design:
//  - Wave 1 is forewarned at the start of turn 1 and emerges when turn 1 ends.
//  - Wave 2 is forewarned at the end of turn 4 and emerges at the end of turn 5.
//  - Wave 3 is forewarned at the end of turn 8 and emerges at the end of turn 9.
//  - The boss wave is forewarned at the end of turn 10 and emerges on turn 11,
//    always on the centre path.
// Paths: 0 = left, 1 = middle, 2 = right.
export const BATTLE_ONE = {
  name: 'The Lower Gate',
  obeliskHp: 20,
  waves: [
    {
      warnAtEnd: 0, // shown at battle start
      spawnAtEnd: 1,
      spawns: [
        { path: 0, enemy: 'footman' },
        { path: 1, enemy: 'footman' },
      ],
    },
    {
      warnAtEnd: 4,
      spawnAtEnd: 5,
      spawns: [
        { path: 1, enemy: 'hound' },
        { path: 2, enemy: 'footman' },
        { path: 2, enemy: 'crossbow' },
      ],
    },
    {
      warnAtEnd: 8,
      spawnAtEnd: 9,
      spawns: [
        { path: 0, enemy: 'shieldbearer' },
        { path: 1, enemy: 'footman' },
        { path: 2, enemy: 'hound' },
        { path: 0, enemy: 'crossbow' },
      ],
    },
    {
      warnAtEnd: 10,
      spawnAtEnd: 11,
      isBoss: true,
      spawns: [
        { path: 1, enemy: 'boss' },
        { path: 0, enemy: 'footman' },
        { path: 2, enemy: 'footman' },
      ],
    },
  ],
};

export const DIALOGUE = {
  intro: [
    'They have found the lower gate, little shepherd.',
    'Their torches are so small. Show them what a flame is for.',
  ],
  wave1Warn: 'Boots on the left and centre paths. Place your faithful.',
  wave2Warn: 'More of them. I feel iron on the right path — and something quick in the middle.',
  wave3Warn: 'A wall of shields comes left. They are getting serious. So should you.',
  bossWarn: 'Ah. Their saint-commander walks the centre path himself. I would shake his hand... if he would only come closer.',
  victory: [
    'The gate holds. The obelisk still sings.',
    'Rest, shepherd. The crusade will try the upper caves next — and I will be watching through you.',
  ],
  defeat: [
    'The obelisk... goes quiet. My grip on this plane thins to a thread.',
    'Do not weep. Threads can be rewoven. Begin again.',
  ],
  bossSpawn: 'There he is. Gold and certainty. Break both.',

  // ---- the tutorial: sermon, lessons, and the scripted doom ----------------
  sermon: [
    'Closer, little flames. Let the stone hear you breathe.',
    'I was old when these mountains were sand, and I have never once dropped what I carried.',
    'The church names me monster. But watch their hands and watch mine — theirs make fists. Mine opens.',
    'Remember, whatever comes: a palm held open, a fist held ready, a sign held high—',
  ],
  sermonCrash: [
    'Boots. Torches. They interrupt a sermon.',
    'Steady, shepherd. I will lend you my hand tonight — show me yours.',
  ],
  tutIntents: 'First: read them. The sigil above each helm confesses what it will do next — advance, strike, worse. Never be surprised.',
  tutPlace: 'Now call a follower. Take the TORCHBEARER ZEALOT from your hand and set it on the tile I have marked. Every follower cries out the moment it lands.',
  tutBurn: 'Impetus is faith on fire, and it never stretches far enough. Feed the flames the SHROUDED WARDEN from your hand — the card burns, the fire grows by one.',
  tutEndTurn: 'Good. End the turn and watch the clash — your ranks always strike first. Use the button at the lower right.',
  tutTk: 'Now for my favor. Seize a crusader with your mind — click it — and hurl it back the way it came. Once each turn, my reach is yours.',
  tutEndTurn2: 'Ha! They do hate that. End the turn.',
  tutRite: 'The rites in your hand are my knuckles. Drag the KINAETIC CRUSH onto a crusader and let it feel what patience weighs.',
  tutEndTurn3: 'More of them on the roads. End the turn — hold your nerve.',
  tutGaze: 'My Eye rests on one path each turn — the faithful there fight harder, and rites cast there cost you nothing. Set your EYE OF KINAETO upon the watched path.',
  tutBeckon: 'One more gift. Release the BECKONING skyward, and I will press three cards into your hand.',
  tutEndTurn4: 'You have every tool I can give. End the turn.',
  tutFree: 'The rest is yours, shepherd. Place, burn, hurl, cast — hold the ceremony grounds.',
  tutWave2Warn: 'More boots on the roads. You know what the sigils mean now — answer them.',
  doomWarn: [
    'Wait.',
    'Something walks behind their lines. Shepherd... that is no soldier.',
  ],
  doomSpawn: 'Sarethiel. The church made flesh. RUN—',
  doomSevered: [
    'The obelisk—! My hand— I cannot hold the door—',
  ],
  dream: [
    'Shepherd. Do not open your eyes. This is the only room they cannot burn.',
    'The obelisk is gravel, and the door it held open is shut. I speak to you now through the crack beneath it.',
    'Do not weep for the ceremony grounds. Stones are patient, and so am I.',
    'Begin again. Gather the faithful, cut a new sanctuary, raise a new obelisk — and I will find your light.',
    'And shepherd — when the Inquisitor comes again, and he will — we shall answer him together.',
  ],
  hubWelcome: [
    'You look rested. Good. The crack beneath the door widens a little every day you keep faith.',
    'The crusade musters at the lower gate. When you are ready, I will carry you there myself.',
  ],
  hubNotReady: 'Take your time. Sharpen the flock at the forge, choose who marches at the altar. I am patient.',
};
