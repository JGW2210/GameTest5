// Engine checks for the battle-flow rework: stacks, clashes, phases, burn —
// plus regressions for cries, keywords, gaze, and intents.
import { Battle } from '../src/battle.js';
import { BATTLE_ONE, TUTORIAL_BATTLE, TUTORIAL_DECK, CARDS } from '../src/data.js';
import { RULES } from '../src/config.js';

let pass = 0;
let fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  ok', name); }
  else { fail++; console.log('  FAIL', name, extra); }
};

let seq = 5000;
const mkEnemy = (b, uid, path, row, over = {}) => {
  const u = { uid, side: 'enemy', key: 'footman', kind: 'melee', name: 'footman',
    hp: 4, maxHp: 4, atk: 2, range: 0, speed: 1, slow: false, boss: false,
    armor: 0, ward: 0, size: 1, arrival: seq++, path, row, stunned: false, actCount: 0, ...over };
  b.units.set(uid, u);
  return u;
};

const fresh = () => {
  const b = new Battle(BATTLE_ONE);
  b.start();
  b.gazePath = 2;
  b.nextGazePath = 2;
  return b;
};

console.log('capacity stacks');
{
  const b = fresh();
  b.hand = ['zealot', 'zealot', 'warden', 'zealot', 'shrine'];
  b.impetus = 8;
  check('1st on tile', b.playCard(0, 0, 1).ok);
  check('2nd on same tile', b.playCard(0, 0, 1).ok);
  check('3rd on same tile', b.playCard(0, 0, 1).ok);
  const r4 = b.playCard(0, 0, 1);
  check('4th rejected (capacity 3)', !r4.ok, r4.reason);
  b.impetus = 8;
  b.hand = ['shrine', 'zealot', 'zealot'];
  const rStone = b.playCard(0, 1, 1);
  check('stone (size 2) placed', rStone.ok);
  check('size-1 fits beside stone', b.playCard(0, 1, 1).ok);
  const rFull = b.playCard(0, 1, 1);
  check('stone tile then full', !rFull.ok, rFull.reason);
}

console.log('clash: full exchange resolves fast');
{
  const b = fresh();
  b.hand = ['zealot', 'warden'];
  b.impetus = 8;
  b.playCard(0, 0, 2); // zealot 3hp 2atk rage
  b.playCard(0, 0, 2); // warden 6hp 1atk armor1 ward2
  const e1 = mkEnemy(b, 801, 0, 2, { hp: 3 });
  const e2 = mkEnemy(b, 802, 0, 2, { hp: 3 });
  const events = [];
  b._stunnedShown = new Set();
  b.phaseClashes(events);
  // zealot (front, arrival first) hits e1 for 2, warden hits e1 for 1 -> e1 dies
  check('front enemy died in one clash', !b.units.has(801));
  const hits = events.filter((ev) => ev.type === 'attack');
  check('multiple strikes in one clash', hits.length >= 3, `hits=${hits.length}`);
  check('clash events batched', hits.every((ev) => ev.batch), JSON.stringify(hits[0]));
  // enemies struck back at the front zealot
  const back = hits.filter((ev) => ev.targetUid && b.units.get(ev.targetUid)?.key === 'zealot' || true);
  check('zealot raged', [...b.units.values()].some((u) => u.key === 'zealot' && u.atk > 2));
}

console.log('breakthrough: cleared tile advances same turn');
{
  const b = fresh();
  b.hand = ['zealot'];
  b.impetus = 8;
  b.playCard(0, 1, 2);
  const z = [...b.units.values()].find((u) => u.key === 'zealot');
  z.atk = 9; // guarantee the kill
  mkEnemy(b, 803, 1, 2, { hp: 1 });
  const events = b.endTurn();
  check('enemy died in clash', !b.units.has(803));
  check('zealot advanced after clearing', z.row === 3, `row=${z.row}`);
}

console.log('engaged units hold; enemies stack on advance');
{
  const b = fresh();
  b.hand = ['warden'];
  b.impetus = 8;
  b.playCard(0, 2, 2);
  mkEnemy(b, 804, 2, 3, { hp: 9 });
  mkEnemy(b, 805, 2, 4, { hp: 9 });
  const events = b.endTurn();
  const e1 = b.units.get(804);
  const e2 = b.units.get(805);
  check('first enemy engaged warden tile', e1.row === 2, `row=${e1.row}`);
  check('second enemy stacked in behind', e2.row <= 3, `row=${e2.row}`);
}

console.log('burn for impetus');
{
  const b = fresh();
  b.hand = ['zealot', 'warden'];
  b.impetus = 4;
  const r = b.burnCard(0);
  check('burn ok', r.ok && r.events[0].type === 'burn');
  check('impetus +1', b.impetus === 5);
  check('hand shrank', b.hand.length === 1);
  b.impetus = RULES.impetusBurnMax;
  const r2 = b.burnCard(0);
  check('burn capped at max', !r2.ok);
}

console.log('hand cap 8');
{
  const b = fresh();
  check('cap respected on draws', b.hand.length <= RULES.handMax);
  b.hand = new Array(8).fill('zealot');
  b.drawCards(3);
  check('no draw past 8', b.hand.length === 8);
}

console.log('surging spawns stack at the mouth');
{
  const b = fresh();
  b.wavesSpawned = 0;
  b.def = { ...b.def, waves: [{ warnAtEnd: 99, spawnAtEnd: b.turn, spawns: [
    { path: 1, enemy: 'footman' }, { path: 1, enemy: 'footman' }, { path: 1, enemy: 'hound' },
  ] }] };
  const events = [];
  b.spawnDueWave(events);
  const rows = b.aliveEnemies().map((u) => u.row);
  check('three spawned', rows.length === 3, JSON.stringify(rows));
  check('all stacked at row 6', rows.every((r) => r === 6), JSON.stringify(rows));
}

console.log('tk capacity-aware + intents');
{
  const b = fresh();
  b.hand = ['zealot', 'zealot', 'zealot', 'warden'];
  b.impetus = 8;
  b.playCard(0, 0, 1);
  b.playCard(0, 0, 1);
  b.playCard(0, 0, 1); // tile 0,1 full
  b.playCard(0, 1, 1);
  const w = [...b.units.values()].find((u) => u.key === 'warden');
  const opts = b.tkMoveOptions(w.uid);
  check('tk cannot move into full stack', !opts.some((o) => o.path === 0 && o.row === 1), JSON.stringify(opts));
  mkEnemy(b, 806, 1, 1, { hp: 9 }); // engaged with warden
  mkEnemy(b, 807, 2, 5);
  const intents = Object.fromEntries(b.computeIntents().map((i) => [i.uid, i.intent]));
  check('engaged enemy intent strike', intents[806] === 'strike', intents[806]);
  check('free enemy intent advance', intents[807] === 'advance', intents[807]);
}

console.log('regressions: cries, gaze, rites');
{
  const b = fresh();
  const e = mkEnemy(b, 808, 0, 5);
  b.hand = ['zealot', 'crush'];
  b.impetus = 8;
  b.playCard(0, 0, 1);
  check('arrival bolt still fires', e.hp === 3, `hp=${e.hp}`);
  b.gazePath = 0;
  const r = b.playTkCard(0, 808);
  check('rite under gaze still free', b.kinaeticAvailable());
  const next = b.nextGazePath;
  const evs = b.endTurn();
  check('gaze still rotates', b.gazePath === next);
  check('turnStart carries intents', evs.some((ev) => ev.type === 'turnStart' && Array.isArray(ev.intents)));
}

console.log('injectable deck / cards / draw order');
{
  const b = new Battle(TUTORIAL_BATTLE, { deck: TUTORIAL_DECK, noShuffle: true });
  b.start();
  check('opening hand drawn in listed order',
    JSON.stringify(b.hand) === JSON.stringify(TUTORIAL_DECK.slice(0, RULES.drawInitial)),
    JSON.stringify(b.hand));
  const forged = { ...CARDS, zealot: { ...CARDS.zealot, atk: CARDS.zealot.atk + 1, hp: CARDS.zealot.hp + 1 } };
  const b2 = new Battle(BATTLE_ONE, { cards: forged });
  b2.start();
  b2.hand = ['zealot'];
  b2.impetus = 8;
  b2.playCard(0, 0, 1);
  const z = [...b2.units.values()].find((u) => u.key === 'zealot');
  check('forged stats reach the unit', z.atk === CARDS.zealot.atk + 1 && z.maxHp === CARDS.zealot.hp + 1, `atk=${z.atk}`);
}

console.log('tutorial scripting: preset, forced spawn, doom');
{
  const b = new Battle(TUTORIAL_BATTLE, { deck: TUTORIAL_DECK, noShuffle: true });
  b.start();
  const preset = b.placePreset('warden', 1, 1);
  check('preset unit exists on its tile', b.unitAt(1, 1, 'player')?.uid === preset.uid);
  check('preset costs nothing', b.impetus === RULES.impetusPerTurn);
  const spawnEvents = b.spawnWaveNow(b.def.waves[0]);
  check('forced wave spawns immediately', spawnEvents.filter((e) => e.type === 'spawn').length === 2);
  check('forced spawn leaves counter to the caller', b.wavesSpawned === 0);
  // no-victory battles never emit win, even with all waves down
  b.wavesSpawned = b.def.waves.length;
  for (const u of [...b.units.values()]) if (u.side === 'enemy') b.units.delete(u.uid);
  const evs = [];
  check('noVictory battle refuses to end in win', !b.checkEnd(evs) && evs.length === 0, JSON.stringify(evs));
  const doomEvents = b.doom();
  check('doom stuns every faithful soul', doomEvents.filter((e) => e.type === 'doomStun').length === 1);
  check('doom shatters the obelisk', b.obeliskHp === 0 && doomEvents.some((e) => e.type === 'obeliskShatter'));
  check('doom ends in loss', b.over && b.result === 'lose' && doomEvents.at(-1).type === 'lose');
  check('preset unit is stunned', b.units.get(preset.uid).stunned);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
