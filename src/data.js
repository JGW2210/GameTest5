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
    desc: 'Advances each turn. Attacks foes sharing its tile.',
    flavor: 'The flame goes where the hand wills.',
  },
  warden: {
    key: 'warden',
    name: 'Shrouded Warden',
    type: 'palm',
    cost: 1,
    hp: 6,
    atk: 1,
    desc: 'Holds its tile. Strikes back at foes sharing it.',
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
    desc: 'Range 3 along its path. Immovable — even to Kinaeto.',
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
    desc: 'Fast: may be placed on the 3rd tile of your half.',
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
    desc: 'Range 5 along its path. Immovable — even to Kinaeto.',
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
};

// Starting deck for the prototype run (drawn 5 at a time, reshuffles).
export const STARTER_DECK = [
  'zealot', 'zealot', 'zealot', 'zealot',
  'warden', 'warden', 'warden',
  'acolyte', 'acolyte',
  'fleet', 'fleet',
  'eye',
  'shrine', 'shrine',
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
    hp: 8,
    atk: 1,
    desc: 'Heavily armoured. Advances every other turn.',
  },
  boss: {
    key: 'boss',
    name: 'Saint-Commander Aurel',
    kind: 'melee',
    boss: true,
    hp: 26,
    atk: 4,
    desc: 'Too heavy to Move or Push. Crush is halved. Every 2nd turn: Consecration — 2 damage to every cultist on his path.',
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
