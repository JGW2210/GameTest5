// Persistent run-to-run state for the hub: which cards the cult owns, which
// march in the deck, what the smith has forged, and story progress. Stored in
// localStorage; everything degrades gracefully if storage is unavailable.

import { CARDS, STARTER_DECK } from './data.js';

const STORE_KEY = 'kinaeto-meta-v1';

export const DECK_MIN = 15;
export const DECK_MAX = 25;
export const FORGE_CHARGES = 3; // free smith upgrades in this pass

// The cult owns its starter deck plus a few spare faithful, so the card
// altar has real choices to make from the first visit.
const EXTRA_COLLECTION = ['zealot', 'warden', 'fleet', 'acolyte', 'eye', 'shrine'];

function defaultMeta() {
  const collection = {};
  for (const key of [...STARTER_DECK, ...EXTRA_COLLECTION]) {
    collection[key] = (collection[key] || 0) + 1;
  }
  return {
    tutorialDone: false,
    battlesWon: 0,
    deck: STARTER_DECK.slice(),
    collection,
    upgrades: {}, // key -> {atk, hp}
  };
}

export function loadMeta() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultMeta();
    const stored = JSON.parse(raw);
    return { ...defaultMeta(), ...stored };
  } catch (e) {
    return defaultMeta();
  }
}

export function saveMeta(meta) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(meta));
  } catch (e) {
    // storage unavailable — the run still works, it just won't persist
  }
}

export function resetMeta() {
  const meta = defaultMeta();
  saveMeta(meta);
  return meta;
}

export function forgeChargesUsed(meta) {
  return Object.values(meta.upgrades).reduce((s, u) => s + (u.atk || 0) + (u.hp || 0), 0);
}

export function forgeChargesLeft(meta) {
  return Math.max(0, FORGE_CHARGES - forgeChargesUsed(meta));
}

export function canUpgrade(key) {
  const def = CARDS[key];
  return !!def && def.type !== 'tk'; // rites are Kinaeto's own — the smith won't touch them
}

export function applyUpgrade(meta, key, stat) {
  if (!canUpgrade(key) || forgeChargesLeft(meta) <= 0) return false;
  const u = meta.upgrades[key] || (meta.upgrades[key] = { atk: 0, hp: 0 });
  u[stat] = (u[stat] || 0) + 1;
  saveMeta(meta);
  return true;
}

// The card table the battle (and the card faces) actually use: base defs
// with the smith's work folded in.
export function effectiveCards(meta) {
  const out = {};
  for (const [key, def] of Object.entries(CARDS)) {
    const u = meta && meta.upgrades[key];
    if (!u || (!u.atk && !u.hp)) {
      out[key] = def;
      continue;
    }
    out[key] = {
      ...def,
      atk: def.atk + (u.atk || 0),
      hp: def.hp + (u.hp || 0),
      forged: (u.atk || 0) + (u.hp || 0),
    };
  }
  return out;
}

export function deckCount(meta, key) {
  return meta.deck.filter((k) => k === key).length;
}

export function addToDeck(meta, key) {
  if (meta.deck.length >= DECK_MAX) return { ok: false, reason: `The deck holds at most ${DECK_MAX}` };
  if (deckCount(meta, key) >= (meta.collection[key] || 0)) {
    return { ok: false, reason: 'No more copies among the faithful' };
  }
  meta.deck.push(key);
  saveMeta(meta);
  return { ok: true };
}

export function removeFromDeck(meta, key) {
  if (meta.deck.length <= DECK_MIN) return { ok: false, reason: `At least ${DECK_MIN} must march` };
  const i = meta.deck.indexOf(key);
  if (i < 0) return { ok: false, reason: 'None in the deck' };
  meta.deck.splice(i, 1);
  saveMeta(meta);
  return { ok: true };
}
