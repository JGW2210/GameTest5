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
    desc: 'Blocks a tile. Telekinesis may hurl it anywhere.',
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
    hp: 26,
    atk: 4,
    desc: 'ARMOR 1. Too heavy to Move or Push. Crush is halved. Every 2nd turn: Consecration — 2 damage to every cultist on his path.',
  },
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
};
