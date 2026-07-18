// Core battle engine. Pure game logic — no rendering. Every mutating method
// returns an ordered list of events the view layer animates one by one.
//
// Event types:
//  turnStart {turn, impetus, impetusMax, kinaetic, hand} — new player turn
//  draw     {hand}                              — extra cards drawn mid-turn
//  place    {unit}                              — card resolved onto a tile
//  warn     {paths, isBoss}                     — forewarning of next wave
//  spawn    {unit, isBoss}                      — enemy emerged at a path entrance
//  move     {uid, from, to, tk}                 — unit moved one or more tiles
//  attack   {uid, targetUid, dmg, targetHp}     — melee hit
//  shoot    {uid, targetUid, dmg, targetHp}     — ranged hit
//  die      {uid}                               — unit destroyed
//  obeliskHit {uid, dmg, hp}                    — obelisk damaged
//  bossAbility {uid, victims:[{uid,dmg,hp}]}    — Consecration
//  crush    {uid, dmg, hp}                      — telekinetic crush
//  trip     {uid}                               — telekinetic trip (stun)
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
    // Impetus: flame energy that calls troops. Flat per turn — never grows.
    this.impetus = RULES.impetusPerTurn;
    // Kinaetic focus: Kinaeto reaches through you once per turn. Spent by
    // moving/pushing units or by casting a Kinaetic Rite card.
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
  }

  // ---- setup -------------------------------------------------------------

  start() {
    const events = [];
    this.drawCards(RULES.drawInitial);
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
    };
  }

  kinaeticAvailable() {
    return !this.over && this.kinaeticUsed < RULES.kinaeticPerTurn;
  }

  // Draw up to n cards, never past the hand cap; undrawn cards stay in the
  // deck for future turns. Played cards cycle back in via the discard pile.
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

  // ---- queries -----------------------------------------------------------

  unitAt(path, row, side) {
    for (const u of this.units.values()) {
      if (u.path === path && u.row === row && (!side || u.side === side)) return u;
    }
    return null;
  }

  aliveEnemies() {
    return [...this.units.values()].filter((u) => u.side === 'enemy');
  }

  snapshot(u) {
    return { ...u };
  }

  // ---- card placement ----------------------------------------------------

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
    if (this.unitAt(path, row, 'player')) return { ok: false, reason: 'Tile already held by a follower' };
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
      path,
      row,
      stunned: false,
      actCount: 0,
    };
    this.units.set(unit.uid, unit);
    return { ok: true, events: [{ type: 'place', unit: this.snapshot(unit) }] };
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

  // All tiles Kinaeto could carry this unit to: adjacent tiles are a Move,
  // two tiles along its own path are a Push.
  tkMoveOptions(uid) {
    const u = this.units.get(uid);
    if (!u || !this.canTkGrab(uid).ok) return [];
    const options = [];
    const candidates = [
      { path: u.path, row: u.row - 1, power: 'move' },
      { path: u.path, row: u.row + 1, power: 'move' },
      { path: u.path - 1, row: u.row, power: 'move' },
      { path: u.path + 1, row: u.row, power: 'move' },
    ];
    for (const c of candidates) {
      if (c.path < 0 || c.path >= PATHS || c.row < 0 || c.row >= ROWS) continue;
      if (this.unitAt(c.path, c.row, u.side)) continue; // same side blocks
      options.push(c);
    }
    for (const dir of [-1, 1]) {
      let landing = u.row;
      for (let step = 0; step < RULES.pushDistance; step++) {
        const next = landing + dir;
        if (next < 0 || next >= ROWS) break;
        if (this.unitAt(u.path, next, u.side)) break; // same side blocks
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
    this.kinaeticUsed++;
    const events = [];

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

  // ---- end of turn resolution -------------------------------------------

  endTurn() {
    if (this.over) return [];
    const events = [];

    this.actPlayerUnits(events);
    if (!this.checkEnd(events)) this.actEnemyUnits(events);
    if (!this.checkEnd(events)) this.spawnDueWave(events);
    this.emitDueWarn(events);
    if (this.checkEnd(events)) return events;

    // next turn — the hand carries over; draw 3 more up to the cap
    this.turn++;
    this.impetus = RULES.impetusPerTurn;
    this.kinaeticUsed = 0;
    this.drawCards(RULES.drawPerTurn);
    events.push(this.turnStartEvent());
    return events;
  }

  dealDamage(events, attacker, target, dmg, kind) {
    target.hp -= dmg;
    events.push({
      type: kind,
      uid: attacker.uid,
      targetUid: target.uid,
      dmg,
      targetHp: target.hp,
    });
    if (target.hp <= 0) {
      this.units.delete(target.uid);
      events.push({ type: 'die', uid: target.uid });
    }
  }

  actPlayerUnits(events) {
    // Front-most units act first so a column can advance in one turn.
    const players = [...this.units.values()]
      .filter((u) => u.side === 'player')
      .sort((a, b) => b.row - a.row);

    for (const u of players) {
      if (!this.units.has(u.uid)) continue;
      if (u.stunned) {
        u.stunned = false;
        events.push({ type: 'stunned', uid: u.uid });
        continue;
      }
      if (u.type === 'fist') {
        const foe = this.unitAt(u.path, u.row, 'enemy');
        if (foe) {
          this.dealDamage(events, u, foe, u.atk, 'attack');
        } else {
          const next = u.row + 1;
          if (next < ROWS && !this.unitAt(u.path, next, 'player')) {
            const from = { path: u.path, row: u.row };
            u.row = next;
            events.push({ type: 'move', uid: u.uid, from, to: { path: u.path, row: u.row } });
          }
        }
      } else if (u.type === 'sign') {
        let best = null;
        for (const e of this.aliveEnemies()) {
          if (e.path !== u.path) continue;
          const d = Math.abs(e.row - u.row);
          if (d <= u.range && (!best || d < Math.abs(best.row - u.row))) best = e;
        }
        if (best) this.dealDamage(events, u, best, u.atk, 'shoot');
      } else if (u.type === 'palm') {
        const foe = this.unitAt(u.path, u.row, 'enemy');
        if (foe && u.atk > 0) this.dealDamage(events, u, foe, u.atk, 'attack');
      }
      // 'object' does nothing
    }
  }

  actEnemyUnits(events) {
    // Enemies closest to the obelisk act first.
    const enemies = this.aliveEnemies().sort((a, b) => a.row - b.row);

    for (const u of enemies) {
      if (!this.units.has(u.uid)) continue;
      if (u.stunned) {
        u.stunned = false;
        events.push({ type: 'stunned', uid: u.uid });
        continue;
      }
      u.actCount++;

      if (u.boss && u.actCount % 2 === 0) {
        // Consecration: 2 damage to every player unit on the boss's path.
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

      const defender = this.unitAt(u.path, u.row, 'player');
      if (defender) {
        this.dealDamage(events, u, defender, u.atk, 'attack');
        continue;
      }

      if (u.kind === 'ranged') {
        let best = null;
        for (const p of [...this.units.values()]) {
          if (p.side !== 'player' || p.path !== u.path) continue;
          const d = Math.abs(p.row - u.row);
          if (d <= u.range && (!best || d < Math.abs(best.row - u.row))) best = p;
        }
        if (best) {
          this.dealDamage(events, u, best, u.atk, 'shoot');
          continue;
        }
      }

      if (u.row === OBELISK_ROW) {
        this.obeliskHp -= u.atk;
        events.push({ type: 'obeliskHit', uid: u.uid, dmg: u.atk, hp: this.obeliskHp });
        continue;
      }

      if (u.slow && u.actCount % 2 === 1) continue; // shieldbearers move every other turn

      const steps = u.speed || 1;
      const from = { path: u.path, row: u.row };
      let moved = false;
      for (let s = 0; s < steps; s++) {
        const next = u.row - 1;
        if (next < 0) break;
        if (this.unitAt(u.path, next, 'enemy')) break; // don't stack enemies
        u.row = next;
        moved = true;
        if (this.unitAt(u.path, next, 'player')) break; // engage defenders
      }
      if (moved) {
        events.push({ type: 'move', uid: u.uid, from, to: { path: u.path, row: u.row } });
      }
    }
  }

  spawnDueWave(events) {
    const wave = this.def.waves[this.wavesSpawned];
    if (!wave || wave.spawnAtEnd !== this.turn) return;
    this.wavesSpawned++;
    for (const s of wave.spawns) {
      const def = ENEMIES[s.enemy];
      // Enter at the mouth of the path; slot back-to-front if crowded.
      let row = ROWS - 1;
      while (row > 0 && this.unitAt(s.path, row, 'enemy')) row--;
      if (this.unitAt(s.path, row, 'enemy')) continue; // path mouth fully jammed
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
