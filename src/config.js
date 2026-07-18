// Global layout + rules constants for the battle board.
// Board layout: 3 paths (x positions), 7 rows each.
// Row 0 = inside the obelisk room (top of screen, far from camera).
// Rows 1-3 = player's half of the path. Rows 4-6 = enemy half.
// Enemies spawn at row 6 and advance toward row 0.

export const PATHS = 3;
export const ROWS = 7;
export const OBELISK_ROW = 0;
export const PLAYER_ROWS = [1, 2, 3];
export const ENEMY_ROWS = [4, 5, 6];

export const PATH_X = [-5.2, 0, 5.2];
export const ROW_SPACING = 2.45;
export const ROW_Z0 = -8.6; // z of row 0
export const rowZ = (row) => ROW_Z0 + row * ROW_SPACING;

export const TILE_SIZE = 2.3;
export const TILE_H = 0.28;
export const UNIT_Y = TILE_H; // top surface of tiles

export const OBELISK_POS = { x: 0, y: 0, z: -12.6 };
// The portal floats above the obelisk tip so Kinaeto's hand never clips the spire.
export const PORTAL_POS = { x: 0, y: 9.6, z: -15.4 };

// Camera poses for the cursor-driven vertical glance and the Kinaeto close-up.
export const CAMERA = {
  fov: 42,
  pos: { x: 0, y: 16.5, z: 18 },
  look: { x: 0, y: -0.5, z: -1.2 },
};
export const CAMERA_POSES = {
  default: { pos: [0, 16.5, 18], look: [0, -0.5, -1.2] },
  bottom: { pos: [0, 15, 17.5], look: [0, -0.8, 5.2] },
  top: { pos: [0, 12.2, 13.2], look: [0, 4.8, -9.8] },
  kinaeto: { pos: [0, 10.4, -1.2], look: [0, 8.9, -13.6] },
  // Fixed side views (arrow keys / swipe): stand at one wall, face the other.
  sideLeft: { pos: [-10.5, 6.2, -1.5], look: [13.5, 3.4, -2.5] },
  sideRight: { pos: [10.5, 6.2, -1.5], look: [-13.5, 3.4, -2.5] },
};

export const WALLS = {
  x: 13.8, // slab centre distance from the middle path
  y: 3.6,
  z: -3,
  left: { text: 'KINAETO IS KIND', glyphs: ['palm', 'palm'] },
  right: { text: 'THE DIVINE HAND CARRIES ALL', glyphs: ['fist', 'sign'] },
};

export const RULES = {
  drawPerTurn: 5,
  handMax: 10,
  startEnergy: 3,
  maxEnergy: 7,
  energyGrowthEveryTurns: 2, // +1 max energy every N turns
  obeliskHp: 20,
  telekinesisPerTurn: 1,
  crushDamage: 3,
  pushDistance: 2,
  // Placement: base units on rows 1-2 (+ obelisk room row 0),
  // fast units also on row 3.
  baseRows: [0, 1, 2],
  fastRows: [0, 1, 2, 3],
};

export const COLORS = {
  fog: 0x0d0708,
  rock: 0x38292a,
  rockDark: 0x241a1c,
  floor: 0x2e2224,
  tilePlayer: 0x3d2f4e,
  tileObelisk: 0x4c3668,
  tileEnemy: 0x4a2f28,
  tileEdge: 0x120c14,
  torch: 0xff8a3c,
  ember: 0xff6a2a,
  kinaetic: 0x9b6cff,
  kinaeticGlow: 0xb08aff,
  eldritch: 0x59f0c8,
  obelisk: 0x1d1430,
  rune: 0xa77bff,
  palm: 0x3fb8a0,
  fist: 0xc8452f,
  sign: 0x8f65ff,
  object: 0x8d8478,
  enemy: 0xcfc4a8,
  enemyAccent: 0xd8a83c,
  boss: 0xf3e6c2,
  warn: 0xff3b30,
  hpGood: 0x6be08a,
  hpBad: 0xe0574f,
};
