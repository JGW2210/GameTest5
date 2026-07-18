// The First Night — the guided tutorial. A scripted sermon to a pre-placed
// congregation, crashed by crusaders; then a locked step-by-step lesson in
// every mechanic; then the scripted doom: the Grand Inquisitor arrives, stuns
// the faithful with a word, and shatters the obelisk. Unwinnable by design.
//
// The controller owns three surfaces:
//  gate(action, payload) — main's input handlers ask before any player action
//  noteAction(action)    — main reports a completed action
//  afterEvents()         — called when an event batch finishes animating;
//                          advances steps and fires the doom

import * as THREE from 'three';
import { DIALOGUE, SERMON_FLOCK } from './data.js';
import { COLORS } from './config.js';
import { sleep } from './effects.js';

export class Tutorial {
  // ctx: {battle, board, hud, world, kinaeto, cardHand, tweens, unitViews,
  //       setIntent, kinaetoSpeaks, processEvents, addUnitView, settleUnits,
  //       setMode, onComplete}
  constructor(ctx) {
    this.ctx = ctx;
    this.active = true;
    this.cinematic = true; // input fully locked during scripted beats
    this.doomStarted = false;
    this.stepIndex = -1;
    this.pendingAdvance = false;

    const b = ctx.battle;
    this.steps = [
      {
        id: 'place',
        line: DIALOGUE.tutPlace,
        hint: 'Drag the TORCHBEARER ZEALOT onto the marked tile',
        action: 'placeCard',
        cells: () => [{ path: 1, row: 2 }],
        allow: {
          dragCard: (p) => p.key === 'zealot',
          placeCard: (p) => p.key === 'zealot' && p.path === 1 && p.row === 2,
        },
        deny: 'Kinaeto murmurs: the Zealot first — onto the marked tile.',
      },
      {
        id: 'burn',
        line: DIALOGUE.tutBurn,
        hint: 'Drag the SHROUDED WARDEN into the flames at the lower left',
        action: 'burn',
        allow: {
          dragCard: (p) => p.key === 'warden',
          burn: () => true,
        },
        deny: 'Kinaeto murmurs: the Warden, into the flames.',
      },
      {
        id: 'end1',
        line: DIALOGUE.tutEndTurn,
        hint: 'Press END TURN (lower right)',
        action: 'endTurn',
        allow: { endTurn: () => true },
        deny: 'Kinaeto murmurs: end the turn — watch what your faithful do.',
      },
      {
        id: 'tk',
        line: DIALOGUE.tutTk,
        hint: 'Click a crusader, then click a glowing tile to hurl it',
        action: 'tkMove',
        allow: {
          tk: (p) => p.side === 'enemy',
          tkMove: () => true,
        },
        deny: 'Kinaeto murmurs: lay your mind on a crusader, not your own.',
      },
      {
        id: 'end2',
        line: DIALOGUE.tutEndTurn2,
        hint: 'Press END TURN',
        action: 'endTurn',
        allow: { endTurn: () => true },
        deny: 'Kinaeto murmurs: end the turn.',
      },
      {
        id: 'rite',
        line: DIALOGUE.tutRite,
        hint: 'Drag KINAETIC CRUSH onto a crusader',
        action: 'rite',
        allow: {
          dragCard: (p) => p.key === 'crush',
          rite: (p) => p.key === 'crush' && p.targetSide === 'enemy',
        },
        deny: 'Kinaeto murmurs: the Crush, upon a crusader.',
      },
      {
        id: 'end3',
        line: DIALOGUE.tutEndTurn3,
        hint: 'Press END TURN',
        action: 'endTurn',
        allow: { endTurn: () => true },
        deny: 'Kinaeto murmurs: end the turn — steel yourself.',
      },
      {
        id: 'gaze',
        line: DIALOGUE.tutGaze,
        hint: 'Place the EYE OF KINAETO on the watched (violet-lit) path',
        action: 'placeCard',
        cells: () => {
          const cells = [];
          for (const row of [0, 1, 2]) {
            if (b.hasSpace(b.gazePath, row, 'player', 1)) cells.push({ path: b.gazePath, row });
          }
          return cells;
        },
        allow: {
          dragCard: (p) => p.key === 'eye',
          placeCard: (p) => p.key === 'eye' && p.path === b.gazePath,
        },
        deny: 'Kinaeto murmurs: the Eye belongs on the watched path.',
      },
      {
        id: 'beckon',
        line: DIALOGUE.tutBeckon,
        hint: 'Drag KINAETO’S BECKONING upward and release it above the battlefield',
        action: 'rite',
        allow: {
          dragCard: (p) => p.key === 'beckon',
          rite: (p) => p.key === 'beckon',
        },
        deny: 'Kinaeto murmurs: the Beckoning — release it to the air.',
      },
      {
        id: 'end4',
        line: DIALOGUE.tutEndTurn4,
        hint: 'Press END TURN',
        action: 'endTurn',
        allow: { endTurn: () => true },
        deny: 'Kinaeto murmurs: end the turn.',
      },
      {
        id: 'free',
        line: DIALOGUE.tutFree,
        hint: 'Free rein — place, burn, hurl, cast. Then end the turn.',
        action: null,
        allow: 'all',
      },
    ];

    // pulsing target marker over the tile a step points at
    this.marker = new THREE.Mesh(
      new THREE.TorusGeometry(0.95, 0.07, 8, 28),
      new THREE.MeshBasicMaterial({ color: COLORS.eldritch, transparent: true, opacity: 0.9 })
    );
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.visible = false;
    ctx.world.scene.add(this.marker);
    this.markerTime = 0;
  }

  current() {
    return this.steps[this.stepIndex] || null;
  }

  // ---- the sermon and the crash --------------------------------------------

  async begin() {
    const { battle, board, hud, world, kinaetoSpeaks, processEvents, addUnitView, settleUnits } = this.ctx;

    // The congregation stands assembled, every hood turned toward Kinaeto.
    for (const s of SERMON_FLOCK) {
      const unit = battle.placePreset(s.key, s.path, s.row);
      const group = addUnitView(unit);
      group.rotation.y = Math.PI; // facing the obelisk — facing him
    }
    settleUnits();

    await processEvents(battle.start());
    await kinaetoSpeaks(DIALOGUE.sermon);

    // Crusaders crash the ceremony mid-sentence.
    hud.banner('THE CEREMONY IS BROKEN', 'warn');
    world.addShake(0.5);
    const crash = battle.spawnWaveNow(battle.def.waves[0]);
    battle.wavesSpawned = 1;
    hud.setWave(`Wave ${battle.wavesSpawned} / ${battle.def.waves.length}`);
    await processEvents(crash);

    // The congregation turns to face the gate.
    await this.faceCongregation(0);
    this.refreshIntents();

    await kinaetoSpeaks([...DIALOGUE.sermonCrash, DIALOGUE.tutIntents]);

    this.cinematic = false;
    await this.advance();
  }

  // Tween every player unit's facing (the sermon's about-face). Lands each
  // unit exactly on the given angle so no drift survives the ceremony.
  faceCongregation(angle) {
    const { battle, unitViews, tweens } = this.ctx;
    const jobs = [];
    for (const u of battle.units.values()) {
      if (u.side !== 'player') continue;
      const v = unitViews.get(u.uid);
      if (!v) continue;
      const from = v.group.rotation.y;
      jobs.push(
        tweens.run({
          duration: 0.6,
          onUpdate: (e) => {
            v.group.rotation.y = from + (angle - from) * e;
          },
        }).then(() => {
          v.group.rotation.y = angle;
        })
      );
    }
    return Promise.all(jobs);
  }

  refreshIntents() {
    const { battle, unitViews, setIntent } = this.ctx;
    for (const it of battle.computeIntents()) {
      const v = unitViews.get(it.uid);
      if (v) setIntent(v.group, it.intent);
    }
  }

  // ---- the guided steps ----------------------------------------------------

  gate(action, payload = {}) {
    if (!this.active) return { ok: true };
    if (this.cinematic || this.doomStarted) return { ok: false, reason: 'Kinaeto is speaking — listen.' };
    const st = this.current();
    if (!st || st.allow === 'all') return { ok: true };
    const rule = st.allow[action];
    if (rule && rule(payload)) return { ok: true };
    return { ok: false, reason: st.deny || 'Follow Kinaeto’s voice, shepherd.' };
  }

  noteAction(action) {
    const st = this.current();
    if (!this.active || !st || this.cinematic) return;
    if (st.action === action) this.pendingAdvance = true;
  }

  async advance() {
    this.stepIndex++;
    const st = this.current();
    if (!st) return;
    if (st.line) await this.ctx.kinaetoSpeaks([st.line]);
    this.applyUI();
  }

  // Re-assert the step's hint and target highlights (mode changes wipe them).
  applyUI() {
    const st = this.current();
    if (!this.active || this.cinematic || !st) return;
    this.ctx.hud.setHint(st.hint);
    this.marker.visible = false;
    if (st.cells) {
      const cells = st.cells();
      if (cells.length) {
        this.ctx.board.highlight(cells, COLORS.eldritch);
        const tile = this.ctx.board.tileAt(cells[cells.length - 1].path, cells[cells.length - 1].row);
        this.marker.position.set(tile.position.x, tile.position.y + 0.22, tile.position.z);
        this.marker.visible = true;
      }
    }
  }

  update(dt) {
    if (!this.marker.visible) return;
    this.markerTime += dt;
    const s = 1 + Math.sin(this.markerTime * 4) * 0.08;
    this.marker.scale.setScalar(s);
  }

  // Called by main after every animated event batch settles.
  async afterEvents() {
    if (!this.active || this.cinematic) return;
    const { battle } = this.ctx;
    if (!this.doomStarted && battle.turn > battle.def.doomAfterTurn) {
      await this.runDoom();
      return;
    }
    if (this.pendingAdvance) {
      this.pendingAdvance = false;
      await this.advance();
    } else {
      this.applyUI();
    }
  }

  // ---- the scripted doom ---------------------------------------------------

  async runDoom() {
    this.doomStarted = true;
    this.cinematic = true;
    const { battle, hud, world, kinaeto, kinaetoSpeaks, processEvents, setMode } = this.ctx;
    setMode('busy');
    hud.setHint('');
    this.marker.visible = false;

    await kinaetoSpeaks(DIALOGUE.doomWarn);

    // He arrives on the centre path, and the ground admits it.
    world.addShake(0.5);
    const evs = battle.spawnWaveNow(battle.def.doomWave);
    await processEvents(evs);
    await kinaetoSpeaks([DIALOGUE.doomSpawn]);

    // The Judgement: a blinding word. Every faithful soul drops where it
    // stands, and the obelisk bursts.
    hud.banner('JUDGEMENT — BE STILL', 'boss');
    hud.flash();
    world.addShake(0.6);
    await sleep(650);
    await processEvents(battle.doom());

    // The link severs — Kinaeto's last words come thin through the dark.
    hud.setDialogueDock(false);
    await hud.dialogue(DIALOGUE.doomSevered);
    if (kinaeto.visible) await kinaeto.retreat();
    await sleep(600);

    // The dream: the only room they cannot burn.
    await hud.dream(DIALOGUE.dream);

    this.active = false;
    this.marker.visible = false;
    this.ctx.world.scene.remove(this.marker);
    this.ctx.onComplete();
  }
}
