// Core battle engine. Pure game logic — no rendering. Every mutating method
// returns an ordered list of events the view layer animates one by one.
//
// Turn resolution (Monster Train-style flow):
//   1. casts    — Hand Signs fire (Sweep hits everything in range)
//   2. clashes  — every unit on a contested tile strikes once: the cult
//                 stack first (arrival order, hitting the front enemy),
//                 then surviving enemies hit the front cultist
//   3. advance  — unengaged Closed Fists surge into free space (a stack
//                 that cleared its tile breaks through the same turn)
//   4. enemies  — unengaged crusaders volley / siege / advance
//   5. waves    — spawns (stacked at the mouth), warnings, the gaze turns
//
// Tiles hold up to RULES.tileCapacity total unit size per side; allies
// never block allies. Any card may be burned for +1 Impetus.
//
// Event types (view layer):
//  turnStart {turn, impetus, impetusMax, kinaetic, hand, intents}
//  draw     {hand}                              — extra cards drawn mid-turn
//  burn     {key, impetus, hand}                — card burned for Impetus
//  place    {unit}                              — card resolved onto a tile
//  warn     {paths, isBoss}                     — forewarning of next wave
//  spawn    {unit, isBoss}                      — enemy emerged at a path entrance
//  move     {uid, from, to, tk}                 — unit moved
//  attack / shoot {uid, targetUid, dmg, absorbed, targetHp, batch?}
//  die      {uid}                               — unit destroyed
//  obeliskHit {uid, dmg, hp}                    — obelisk damaged
//  bossAbility {uid, victims:[{uid,dmg,hp}]}    — Consecration
//  crush {uid, dmg, hp} / trip {uid}            — rite effects
//  rage {uid, atk} / ward {uid, amount} / emberBurst {uid, targetUid, dmg, targetHp}
//  gaze {path, next} / gazeFavor {uid}
//  stunned  {uid}                               — unit skipped its action
//  win / lose

import { CARDS, ENEMIES, STARTER_DECK } from './data.js';
import { RULES, ROWS, PATHS, OBELISK_ROW } from './config.js';

let uidCounter = 1;

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class Battle {
  constructor(def) {
    this.def = def;
    this.turn = 1;
    this.impetus = RULES.impetusPerTurn;
    this.kinaeticUsed = 0;
    this.obeliskHp = def.obeliskHp;
    this.obeliskMaxHp = def.obeliskHp;
    this.units = new Map();
    this.deck = shuffle(STARTER_DECK);
    this.hand = [];
    this.discard = [];
    this.wavesSpawned = 0;
    this.over = false;
    this.result = null;
    this.arrivalSeq = 1; // stack ordering: lowest arrival = front of tile
    this.gazePath = Math.floor(Math.random() * PATHS);
    this.nextGazePath = Math.floor(Math.random() * PATHS);
  }

  // ---- gaze ---------------------------------------------------------------

  effAtk(u) {
    return u.atk + (u.side === 'player' && u.path === this.gazePath ? 1 : 0);
  }

  effArmor(u) {
    return (u.armor || 0) + (u.side === 'player' && u.path === this.gazePath ? 1 : 0);
  }

  // ---- setup --------------------------------------------------------------

  start() {
    const events = [];
    this.drawCards(RULES.drawInitial);
    events.push({ type: 'gaze', path: this.gazePath, next: this.nextGazePath });
    events.push(this.turnStartEvent());
    const first = this.def.waves[0];
    if (first && first.warnAtEnd === 0) events.push(this.makeWarn(first));
    return events;
  }

  turnStartEvent() {
    return {
      type: 'turnStart',
      turn: this.turn,
      impetus: this.impetus,
      impetusMax: RULES.impetusPerTurn,
      kinaetic: this.kinaeticAvailable(),
      hand: this.hand.slice(),
      intents: this.computeIntents(),
    };
  }

  kinaeticAvailable() {
    return !this.over && this.kinaeticUsed < RULES.kinaeticPerTurn;
  }

  drawCards(n) {
    for (let i = 0; i < n; i++) {
      if (this.hand.length >= RULES.handMax) break;
      if (this.deck.length === 0) {
        if (this.discard.length === 0) break;
        this.deck = shuffle(this.discard);
        this.discard = [];
      }
      this.hand.push(this.deck.pop());
    }
  }

  // ---- stacks -------------------------------------------------------------

  unitsAt(path, row, side) {
    return [...this.units.values()]
      .filter((u) => u.path === path && u.row === row && (!side || u.side === side))
      .sort((a, b) => a.arrival - b.arrival);
  }

  // Front unit of a stack (oldest arrival) — the one that takes the hits.
  unitAt(path, row, side) {
    return this.unitsAt(path, row, side)[0] || null;
  }

  stackSize(path, row, side) {
    return this.unitsAt(path, row, side).reduce((s, u) => s + (u.size || 1), 0);
  }

  hasSpace(path, row, side, size) {
    return this.stackSize(path, row, side) + size <= RULES.tileCapacity;
  }

  contested(path, row) {
    return !!(this.unitAt(path, row, 'player') && this.unitAt(path, row, 'enemy'));
  }

  aliveEnemies() {
    return [...this.units.values()].filter((u) => u.side === 'enemy');
  }

  snapshot(u) {
    return { ...u };
  }

  // ---- intents ------------------------------------------------------------

  computeIntents() {
    const intents = [];
    for (const u of this.aliveEnemies()) {
      let intent;
      if (u.stunned) intent = 'dazed';
      else if (this.contested(u.path, u.row)) intent = 'strike';
      else if (u.boss && (u.actCount + 1) % 2 === 0) intent = 'ability';
      else if (u.kind === 'ranged' && this.rangedTarget(u)) intent = 'volley';
      else if (u.row === OBELISK_ROW) intent = 'siege';
      else if (u.slow && (u.actCount + 1) % 2 === 1) intent = 'wait';
      else if (u.row > 0 && !this.hasSpace(u.path, u.row - 1, 'enemy', u.size || 1)) intent = 'wait';
      else intent = 'advance';
      u.intent = intent;
      intents.push({ uid: u.uid, intent });
    }
    return intents;
  }

  rangedTarget(u) {
    let best = null;
    for (const p of [...this.units.values()]) {
      if (p.side !== 'player' || p.path !== u.path) continue;
      const d = Math.abs(p.row - u.row);
      if (d <= u.range && (!best || d < Math.abs(best.row - u.row))) best = p;
    }
    return best;
  }

  // ---- card placement -----------------------------------------------------

  placementRows(cardKey) {
    const def = CARDS[cardKey];
    return def.fast ? RULES.fastRows : RULES.baseRows;
  }

  canPlaceCard(handIndex, path, row) {
    if (this.over) return { ok: false, reason: 'battle over' };
    const key = this.hand[handIndex];
    if (!key) return { ok: false, reason: 'no card' };
    const def = CARDS[key];
    if (def.type === 'tk') return { ok: false, reason: 'Rites are cast on units, not tiles' };
    if (def.cost > this.impetus) return { ok: false, reason: 'Not enough Impetus' };
    if (!this.placementRows(key).includes(row)) {
      return { ok: false, reason: def.fast ? 'Place on your half or the obelisk room' : 'Base followers deploy on the first two tiles (or the obelisk room)' };
    }
    if (!this.hasSpace(path, row, 'player', def.size || 1)) {
      return { ok: false, reason: 'No room in that tile’s ranks' };
    }
    return { ok: true };
  }

  playCard(handIndex, path, row) {
    const check = this.canPlaceCard(handIndex, path, row);
    if (!check.ok) return { ok: false, reason: check.reason, events: [] };
    const key = this.hand.splice(handIndex, 1)[0];
    const def = CARDS[key];
    this.impetus -= def.cost;
    this.discard.push(key);
    const unit = {
      uid: uidCounter++,
      side: 'player',
      key,
      name: def.name,
      type: def.type,
      hp: def.hp,
      maxHp: def.hp,
      atk: def.atk,
      range: def.range || 0,
      fast: !!def.fast,
      rage: !!def.rage,
      armor: def.armor || 0,
      sweep: !!def.sweep,
      onDeath: def.onDeath || null,
      ward: 0,
      size: def.size || 1,
      arrival: this.arrivalSeq++,
      path,
      row,
      stunned: false,
      actCount: 0,
    };
    this.units.set(unit.uid, unit);
    const events = [{ type: 'place', unit: this.snapshot(unit) }];
    this.arrivalCry(events, unit, def);
    this.checkEnd(events);
    return { ok: true, events };
  }

  arrivalCry(events, unit, def) {
    if (def.cry === 'bolt') {
      let best = null;
      for (const e of this.aliveEnemies()) {
        if (e.path !== unit.path) continue;
        const d = Math.abs(e.row - unit.row);
        if (!best || d < Math.abs(best.row - unit.row)) best = e;
      }
      if (best) this.dealDamage(events, unit, best, 1, 'shoot', { noRage: true });
    } else if (def.cry === 'ward') {
      unit.ward = 2;
      events.push({ type: 'ward', uid: unit.uid, amount: 2 });
    } else if (def.cry === 'advance') {
      const next = unit.row + 1;
      if (next < ROWS && this.hasSpace(unit.path, next, 'player', unit.size)) {
        const from = { path: unit.path, row: unit.row };
        unit.row = next;
        unit.arrival = this.arrivalSeq++;
        events.push({ type: 'move', uid: unit.uid, from, to: { path: unit.path, row: unit.row } });
      }
    } else if (def.cry === 'draw') {
      this.drawCards(1);
      events.push({ type: 'draw', hand: this.hand.slice() });
    }
  }

  // ---- burning cards for Impetus -----------------------------------------

  canBurnCard(handIndex) {
    if (this.over) return { ok: false, reason: 'battle over' };
    if (!this.hand[handIndex]) return { ok: false, reason: 'no card' };
    if (this.impetus >= RULES.impetusBurnMax) return { ok: false, reason: 'The flames can hold no more' };
    return { ok: true };
  }

  burnCard(handIndex) {
    const check = this.canBurnCard(handIndex);
    if (!check.ok) return { ok: false, reason: check.reason, events: [] };
    const key = this.hand.splice(handIndex, 1)[0];
    this.discard.push(key);
    this.impetus = Math.min(this.impetus + 1, RULES.impetusBurnMax);
    return { ok: true, events: [{ type: 'burn', key, impetus: this.impetus, hand: this.hand.slice() }] };
  }

  // ---- telekinesis: click a unit, choose a tile --------------------------

  canTkGrab(uid) {
    const u = this.units.get(uid);
    if (!u) return { ok: false, reason: 'no target' };
    if (!this.kinaeticAvailable()) return { ok: false, reason: 'Kinaetic focus already spent this turn' };
    if (u.side === 'player' && u.type === 'sign') {
      return { ok: false, reason: 'Moving a Hand Sign would sever its link to Kinaeto' };
    }
    if (u.boss) return { ok: false, reason: 'Too heavy — his faith anchors him' };
    return { ok: true };
  }

  tkMoveOptions(uid) {
    const u = this.units.get(uid);
    if (!u || !this.canTkGrab(uid).ok) return [];
    const options = [];
    const size = u.size || 1;
    const candidates = [
      { path: u.path, row: u.row - 1, power: 'move' },
      { path: u.path, row: u.row + 1, power: 'move' },
      { path: u.path - 1, row: u.row, power: 'move' },
      { path: u.path + 1, row: u.row, power: 'move' },
    ];
    for (const c of candidates) {
      if (c.path < 0 || c.path >= PATHS || c.row < 0 || c.row >= ROWS) continue;
      if (!this.hasSpace(c.path, c.row, u.side, size)) continue;
      options.push(c);
    }
    for (const dir of [-1, 1]) {
      let landing = u.row;
      for (let step = 0; step < RULES.pushDistance; step++) {
        const next = landing + dir;
        if (next < 0 || next >= ROWS) break;
        if (!this.hasSpace(u.path, next, u.side, size)) break;
        landing = next;
      }
      if (Math.abs(landing - u.row) > 1) options.push({ path: u.path, row: landing, power: 'push' });
    }
    return options;
  }

  applyTkMove(uid, dest) {
    const events = [];
    const check = this.canTkGrab(uid);
    if (!check.ok) return { ok: false, reason: check.reason, events };
    const u = this.units.get(uid);
    const found = this.tkMoveOptions(uid).find((d) => d.path === dest.path && d.row === dest.row);
    if (!found) return { ok: false, reason: 'Kinaeto cannot reach that tile', events };
    const from = { path: u.path, row: u.row };
    u.path = dest.path;
    u.row = dest.row;
    u.arrival = this.arrivalSeq++;
    events.push({ type: 'move', uid, from, to: { path: dest.path, row: dest.row }, tk: true, power: found.power });
    this.kinaeticUsed++;
    this.checkEnd(events);
    return { ok: true, events };
  }

  // ---- Kinaetic Rite cards (crush / trip / beckon) ------------------------

  canPlayTkCard(handIndex, targetUid) {
    if (this.over) return { ok: false, reason: 'battle over' };
    const key = this.hand[handIndex];
    const def = key && CARDS[key];
    if (!def || def.type !== 'tk') return { ok: false, reason: 'not a rite' };
    if (!this.kinaeticAvailable()) return { ok: false, reason: 'Kinaetic focus already spent this turn' };
    if (def.power !== 'beckon' && !this.units.get(targetUid)) {
      return { ok: false, reason: 'The rite needs a target' };
    }
    return { ok: true };
  }

  playTkCard(handIndex, targetUid) {
    const check = this.canPlayTkCard(handIndex, targetUid);
    if (!check.ok) return { ok: false, reason: check.reason, events: [] };
    const key = this.hand.splice(handIndex, 1)[0];
    const def = CARDS[key];
    this.discard.push(key);
    const events = [];
    const target = this.units.get(targetUid);
    const underGaze = def.power !== 'beckon' && target && target.path === this.gazePath;
    if (underGaze) events.push({ type: 'gazeFavor', uid: targetUid });
    else this.kinaeticUsed++;

    if (def.power === 'crush') {
      const u = this.units.get(targetUid);
      let dmg = RULES.crushDamage;
      if (u.boss) dmg = Math.floor(dmg / 2);
      u.hp -= dmg;
      events.push({ type: 'crush', uid: targetUid, dmg, hp: u.hp });
      if (u.hp <= 0) {
        this.units.delete(targetUid);
        events.push({ type: 'die', uid: targetUid });
      }
    } else if (def.power === 'trip') {
      this.units.get(targetUid).stunned = true;
      events.push({ type: 'trip', uid: targetUid });
    } else if (def.power === 'beckon') {
      this.drawCards(RULES.beckonDraw);
      events.push({ type: 'draw', hand: this.hand.slice() });
    }

    this.checkEnd(events);
    return { ok: true, events };
  }

  // ---- damage pipeline ----------------------------------------------------

  dealDamage(events, attacker, target, dmg, kind, opts = {}) {
    let amount = dmg;
    if (!opts.pierceArmor) amount = Math.max(amount - this.effArmor(target), 0);
    let absorbed = 0;
    if (target.ward > 0 && amount > 0) {
      absorbed = Math.min(target.ward, amount);
      target.ward -= absorbed;
      amount -= absorbed;
    }
    target.hp -= amount;
    const ev = {
      type: kind,
      uid: attacker.uid,
      targetUid: target.uid,
      dmg: amount,
      absorbed,
      targetHp: target.hp,
    };
    if (opts.batch) ev.batch = opts.batch;
    events.push(ev);
    if (attacker.rage && !opts.noRage) {
      attacker.atk += 1;
      events.push({ type: 'rage', uid: attacker.uid, atk: attacker.atk, batch: opts.batch });
    }
    if (target.hp <= 0) {
      this.units.delete(target.uid);
      events.push({ type: 'die', uid: target.uid, batch: opts.batch });
      if (target.onDeath === 'ember' && this.units.has(attacker.uid)) {
        attacker.hp -= 1;
        events.push({ type: 'emberBurst', uid: target.uid, targetUid: attacker.uid, dmg: 1, targetHp: attacker.hp, batch: opts.batch });
        if (attacker.hp <= 0) {
          this.units.delete(attacker.uid);
          events.push({ type: 'die', uid: attacker.uid, batch: opts.batch });
        }
      }
    }
  }

  // ---- end of turn resolution --------------------------------------------

  endTurn() {
    if (this.over) return [];
    const events = [];
    this._stunnedShown = new Set();

    this.phaseCasts(events);
    if (!this.checkEnd(events)) this.phaseClashes(events);
    if (!this.checkEnd(events)) this.phaseAdvance(events);
    if (!this.checkEnd(events)) this.phaseEnemies(events);
    if (!this.checkEnd(events)) this.spawnDueWave(events);
    this.emitDueWarn(events);
    if (this.checkEnd(events)) return events;

    // recover from stuns, turn the gaze, next turn
    for (const u of this.units.values()) u.stunned = false;
    this.gazePath = this.nextGazePath;
    this.nextGazePath = Math.floor(Math.random() * PATHS);
    events.push({ type: 'gaze', path: this.gazePath, next: this.nextGazePath });

    this.turn++;
    this.impetus = RULES.impetusPerTurn;
    this.kinaeticUsed = 0;
    this.drawCards(RULES.drawPerTurn);
    events.push(this.turnStartEvent());
    return events;
  }

  skipIfStunned(events, u) {
    if (!u.stunned) return false;
    if (!this._stunnedShown.has(u.uid)) {
      this._stunnedShown.add(u.uid);
      events.push({ type: 'stunned', uid: u.uid });
    }
    return true;
  }

  // Phase 1 — Hand Signs cast down their paths.
  phaseCasts(events) {
    const signs = [...this.units.values()]
      .filter((u) => u.side === 'player' && u.type === 'sign')
      .sort((a, b) => b.row - a.row);
    for (const u of signs) {
      if (!this.units.has(u.uid)) continue;
      if (this.skipIfStunned(events, u)) continue;
      if (u.sweep) {
        const targets = this.aliveEnemies().filter(
          (e) => e.path === u.path && Math.abs(e.row - u.row) <= u.range
        );
        for (const e of targets) {
          if (this.units.has(e.uid)) this.dealDamage(events, u, e, this.effAtk(u), 'shoot');
        }
      } else {
        let best = null;
        for (const e of this.aliveEnemies()) {
          if (e.path !== u.path) continue;
          const d = Math.abs(e.row - u.row);
          if (d <= u.range && (!best || d < Math.abs(best.row - u.row))) best = e;
        }
        if (best) this.dealDamage(events, u, best, this.effAtk(u), 'shoot');
      }
    }
  }

  // Phase 2 — full exchanges on every contested tile.
  phaseClashes(events) {
    const tiles = new Set();
    for (const u of this.units.values()) tiles.add(`${u.path}:${u.row}`);
    for (const key of tiles) {
      const [path, row] = key.split(':').map(Number);
      if (!this.contested(path, row)) continue;
      const batch = `clash-${path}-${row}-${this.turn}`;

      // the cult strikes first, in arrival order, at the front crusader
      for (const pu of this.unitsAt(path, row, 'player')) {
        if (!this.units.has(pu.uid) || pu.type === 'object') continue;
        if (this.skipIfStunned(events, pu)) continue;
        if (pu.type === 'sign') continue; // signs already cast this turn
        const foe = this.unitAt(path, row, 'enemy');
        if (!foe) break;
        if (pu.atk <= 0) continue;
        this.dealDamage(events, pu, foe, this.effAtk(pu), 'attack', { batch });
      }

      // survivors strike back at the front cultist
      for (const eu of this.unitsAt(path, row, 'enemy')) {
        if (!this.units.has(eu.uid)) continue;
        if (this.skipIfStunned(events, eu)) continue;
        const def = this.unitAt(path, row, 'player');
        if (!def) break;
        this.dealDamage(events, eu, def, eu.atk, 'attack', { batch });
      }
    }
  }

  // Phase 3 — unengaged Closed Fists advance into free space.
  phaseAdvance(events) {
    const fists = [...this.units.values()]
      .filter((u) => u.side === 'player' && u.type === 'fist')
      .sort((a, b) => b.row - a.row);
    for (const u of fists) {
      if (!this.units.has(u.uid)) continue;
      if (u.stunned) continue; // already showed the stun in clash if any
      if (this.contested(u.path, u.row)) continue; // engaged units hold
      const next = u.row + 1;
      if (next >= ROWS) continue;
      if (!this.hasSpace(u.path, next, 'player', u.size)) continue;
      const from = { path: u.path, row: u.row };
      u.row = next;
      u.arrival = this.arrivalSeq++;
      events.push({ type: 'move', uid: u.uid, from, to: { path: u.path, row: u.row } });
    }
  }

  // Phase 4 — unengaged crusaders act.
  phaseEnemies(events) {
    const enemies = this.aliveEnemies().sort((a, b) => a.row - b.row);
    for (const u of enemies) {
      if (!this.units.has(u.uid)) continue;
      if (this.skipIfStunned(events, u)) continue;
      if (this.contested(u.path, u.row)) continue; // engaged — struck in clash
      u.actCount++;

      if (u.boss && u.actCount % 2 === 0) {
        const victims = [];
        for (const p of [...this.units.values()]) {
          if (p.side !== 'player' || p.path !== u.path) continue;
          p.hp -= 2;
          victims.push({ uid: p.uid, dmg: 2, hp: p.hp });
        }
        events.push({ type: 'bossAbility', uid: u.uid, victims });
        for (const v of victims) {
          if (v.hp <= 0 && this.units.has(v.uid)) {
            this.units.delete(v.uid);
            events.push({ type: 'die', uid: v.uid });
          }
        }
        continue;
      }

      if (u.kind === 'ranged') {
        const target = this.rangedTarget(u);
        if (target) {
          const front = this.unitAt(target.path, target.row, 'player') || target;
          this.dealDamage(events, u, front, u.atk, 'shoot');
          continue;
        }
      }

      if (u.row === OBELISK_ROW) {
        this.obeliskHp -= u.atk;
        events.push({ type: 'obeliskHit', uid: u.uid, dmg: u.atk, hp: this.obeliskHp });
        continue;
      }

      if (u.slow && u.actCount % 2 === 1) continue;

      const steps = u.speed || 1;
      const from = { path: u.path, row: u.row };
      let moved = false;
      for (let s = 0; s < steps; s++) {
        const next = u.row - 1;
        if (next < 0) break;
        if (!this.hasSpace(u.path, next, 'enemy', u.size || 1)) break;
        u.row = next;
        u.arrival = this.arrivalSeq++;
        moved = true;
        if (this.unitAt(u.path, next, 'player')) break; // engage defenders
      }
      if (moved) {
        events.push({ type: 'move', uid: u.uid, from, to: { path: u.path, row: u.row } });
      }
    }
  }

  // Phase 5 — waves surge in, stacked at the path mouths.
  spawnDueWave(events) {
    const wave = this.def.waves[this.wavesSpawned];
    if (!wave || wave.spawnAtEnd !== this.turn) return;
    this.wavesSpawned++;
    for (const s of wave.spawns) {
      const def = ENEMIES[s.enemy];
      const size = def.size || 1;
      let row = -1;
      for (let r = ROWS - 1; r > 0; r--) {
        if (this.hasSpace(s.path, r, 'enemy', size)) {
          row = r;
          break;
        }
      }
      if (row < 0) continue; // the whole path is jammed with crusaders
      const unit = {
        uid: uidCounter++,
        side: 'enemy',
        key: def.key,
        name: def.name,
        kind: def.kind,
        hp: def.hp,
        maxHp: def.hp,
        atk: def.atk,
        range: def.range || 0,
        speed: def.speed || 1,
        slow: !!def.slow,
        boss: !!def.boss,
        armor: def.armor || 0,
        ward: 0,
        size,
        arrival: this.arrivalSeq++,
        path: s.path,
        row,
        stunned: false,
        actCount: 0,
      };
      this.units.set(unit.uid, unit);
      events.push({ type: 'spawn', unit: this.snapshot(unit), isBoss: !!def.boss });
    }
  }

  emitDueWarn(events) {
    const wave = this.def.waves[this.wavesSpawned];
    if (!wave || wave.warnAtEnd !== this.turn) return;
    events.push(this.makeWarn(wave));
  }

  makeWarn(wave) {
    const paths = [...new Set(wave.spawns.map((s) => s.path))];
    return { type: 'warn', paths, isBoss: !!wave.isBoss };
  }

  checkEnd(events) {
    if (this.over) return true;
    if (this.obeliskHp <= 0) {
      this.over = true;
      this.result = 'lose';
      events.push({ type: 'lose' });
      return true;
    }
    if (this.wavesSpawned >= this.def.waves.length && this.aliveEnemies().length === 0) {
      this.over = true;
      this.result = 'win';
      events.push({ type: 'win' });
      return true;
    }
    return false;
  }
}
