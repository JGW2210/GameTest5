// Bootstraps the world and conducts play across the game's states:
//   menu → tutorial (the First Night, scripted loss) → hub ⇄ battle
// Handles input modes (card dragging, telekinesis targeting), sequential
// animation of battle engine events, and the hub's station interactions.

import * as THREE from 'three';
import { World } from '#game/scene.js';
import { Board } from '#game/board.js';
import { Kinaeto } from '#game/kinaeto.js';
import { CardHand, clearCardTextures, setCardSource, cardFaceDataURL } from '#game/cards3d.js';
import { Hud, PATH_NAMES } from '#game/hud.js';
import { Battle } from '#game/battle.js';
import { Tweens, Ease, sleep, floatText } from '#game/effects.js';
import { createUnitGroup, updateUnitGroup, drawHpBar, setIntent } from '#game/units.js';
import { BATTLE_ONE, TUTORIAL_BATTLE, TUTORIAL_DECK, DIALOGUE } from '#game/data.js';
import { RULES, PATHS, ROWS, COLORS, OBELISK_POS, BOARD_THEMES, rowZ } from '#game/config.js';
import { Tutorial } from '#game/tutorial.js';
import { Hub } from '#game/hub.js';
import { loadMeta, saveMeta, effectiveCards } from '#game/meta.js';

const canvas = document.getElementById('game');
const world = new World(canvas);
const tweens = new Tweens();
const board = new Board(world.scene);
const kinaeto = new Kinaeto(world.scene, tweens);
const cardHand = new CardHand(world.camera);
const hud = new Hud();
const metaState = loadMeta();

let battle = null;
let tutorial = null;
let state = 'menu'; // menu | tutorial | hub | battle
let mode = 'menu'; // menu | idle | dragCard | tkSelect | busy
let dragIndex = -1;
let dragIsRite = false; // dragged card is a Kinaetic Rite (targets units)
let tkUid = null; // unit grabbed for a telekinetic move
let tkOptions = []; // {path,row,power} tiles Kinaeto can carry it to
let unitPress = null; // {uid, x, y} — pending click-vs-drag on a unit
let warnCount = 0;
let warnLines = []; // per-battle Kinaeto lines for wave warnings (null = banner only)

const unitViews = new Map(); // uid -> {group, hp, maxHp, path, row, boss}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

// Ghost marker shown on the tile a dragged card would land on.
const ghost = new THREE.Mesh(
  new THREE.TorusGeometry(0.75, 0.06, 8, 24),
  new THREE.MeshBasicMaterial({ color: 0xd9c8ff, transparent: true, opacity: 0.9 })
);
ghost.rotation.x = -Math.PI / 2;
ghost.visible = false;
world.scene.add(ghost);

// ---------------------------------------------------------------------------
// helpers

function setPointer(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, world.camera);
}

function pickCard() {
  const hits = raycaster.intersectObjects(cardHand.meshes, false);
  return hits.length ? hits[0].object : null;
}

function pickTile() {
  const hits = raycaster.intersectObjects(board.tileList, false);
  return hits.length ? hits[0].object : null;
}

function pickUnit() {
  const groups = [...unitViews.values()].map((v) => v.group);
  const hits = raycaster.intersectObjects(groups, true);
  if (!hits.length) return null;
  let obj = hits[0].object;
  while (obj && !(obj.userData && obj.userData.isUnit)) obj = obj.parent;
  return obj;
}

// The tutorial locks input to one taught action per step.
function tutorialGate(action, payload) {
  return tutorial && tutorial.active ? tutorial.gate(action, payload) : { ok: true };
}

// A denied gate with a null reason is a silent denial (cinematics).
function gateAllows(action, payload) {
  const g = tutorialGate(action, payload);
  if (!g.ok && g.reason) hud.toast(g.reason);
  return g.ok;
}

// ---------------------------------------------------------------------------
// unit inspection: intent words on hover, the unit's card on click

const INTENT_TEXT = {
  advance: 'ADVANCE — will march toward the obelisk',
  strike: 'STRIKE — locked in melee; will attack the faithful on its tile',
  volley: 'VOLLEY — will shoot the nearest cultist in range',
  siege: 'SIEGE — will batter the obelisk itself',
  ability: 'ABILITY — will unleash something holy and terrible',
  wait: 'WAIT — braced or blocked; will not advance this turn',
  dazed: 'DAZED — stunned; will skip its next action',
};

function unitTipText(unit) {
  if (unit.side === 'enemy') {
    const intent = INTENT_TEXT[unit.intent] || 'gathering itself';
    return `${unit.name} · ${intent} · click to inspect`;
  }
  const grab = battle.canTkGrab(unit.uid).ok ? ' · drag to move' : '';
  return `${unit.name} · click to inspect${grab}`;
}

function inspectUnit(uid) {
  const u = battle.units.get(uid);
  if (!u) return;
  hud.hideUnitTip();
  const intent = u.side === 'enemy' && INTENT_TEXT[u.intent] ? `Intent: ${INTENT_TEXT[u.intent]}` : '';
  hud.showInspect(cardFaceDataURL(u.key, u.side === 'enemy'), intent);
}

function validPlacementCells(handIndex) {
  const key = battle.hand[handIndex];
  const cells = [];
  for (let p = 0; p < PATHS; p++) {
    for (let r = 0; r < ROWS; r++) {
      if (!battle.canPlaceCard(handIndex, p, r).ok) continue;
      if (!tutorialGate('placeCard', { key, path: p, row: r }).ok) continue;
      cells.push({ path: p, row: r });
    }
  }
  return cells;
}

function refreshHud() {
  if (!battle) return;
  hud.setTurn(battle.turn);
  hud.setWave(`Wave ${battle.wavesSpawned} / ${battle.def.waves.length}`);
  hud.setImpetus(battle.impetus, RULES.impetusPerTurn);
  hud.setKinaetic(battle.kinaeticAvailable());
  hud.setObelisk(battle.obeliskHp, battle.obeliskMaxHp);
  hud.setCounts(battle.deck.length, battle.discard.length);
  cardHand.setAffordable(battle.impetus);
}

// Whether the USE zone should read as live for the card being dragged.
function dragUseEnabled() {
  const key = cardHand.meshes[dragIndex]?.userData.key;
  const def = key && battle && battle.cards[key];
  if (!def) return false;
  if (def.type === 'tk') return battle.kinaeticAvailable();
  return def.cost <= battle.impetus;
}

function setMode(next) {
  mode = next;
  board.clearHighlights();
  ghost.visible = false;
  if (next !== 'idle') world.glanceTarget = 0;
  const hints = {
    idle: 'Drag a card to a tile or the USE circle · click a unit to inspect · drag one to move it',
    dragCard: dragIsRite
      ? 'Drop it on a unit or the USE circle · the flames take any card'
      : 'Drop it on a glowing tile or the USE circle · the flames take any card',
    placeTarget: 'Now choose a glowing tile — right-click to cancel',
    castTarget: 'Now choose a target — right-click to cancel',
    tkSelect: 'Drag to a glowing tile and release',
    busy: '',
    menu: '',
  };
  hud.setHint(hints[next] || '');
  hud.setEndTurnEnabled(next === 'idle');
  if (next === 'dragCard') hud.setDropZones('drag', dragUseEnabled());
  else if (next === 'placeTarget' || next === 'castTarget') hud.setDropZones('placing');
  else hud.setDropZones(null);
  // the tutorial re-asserts its own hint and target markers
  if (next === 'idle' && tutorial && tutorial.active && !tutorial.cinematic) tutorial.applyUI();
}

function cancelAction() {
  if (mode === 'dragCard') cardHand.setDragging(dragIndex, false);
  cardHand.setDocked(-1);
  dragIndex = -1;
  dragIsRite = false;
  tkUid = null;
  tkOptions = [];
  unitPress = null;
  hud.hideUnitTip();
  if (mode !== 'busy' && mode !== 'menu') setMode('idle');
}

function clearUnits() {
  for (const v of unitViews.values()) world.scene.remove(v.group);
  unitViews.clear();
}

// ---------------------------------------------------------------------------
// unit views

function addUnitView(unit, atEntrance = false) {
  const group = createUnitGroup(unit);
  const pos = board.unitPosition(unit.path, unit.row);
  group.position.copy(pos);
  if (atEntrance) group.position.z = rowZ(ROWS - 1) + 3.2;
  world.scene.add(group);
  unitViews.set(unit.uid, {
    group,
    hp: unit.hp,
    maxHp: unit.maxHp,
    path: unit.path,
    row: unit.row,
    boss: !!unit.boss,
    moveGen: 0,
  });
  return group;
}

// When opposing units share a tile they square off: each shifts toward its
// own side of the tile instead of clipping through the other.
function isContested(v) {
  for (const o of unitViews.values()) {
    if (o !== v && o.path === v.path && o.row === v.row && o.group.userData.side !== v.group.userData.side) {
      return true;
    }
  }
  return false;
}

// Formation slots for stacked tiles: front unit centred and forward, the
// next two flanking behind. "Forward" faces the enemy for the cult and the
// obelisk for crusaders.
const STACK_SLOTS = {
  1: [[0, 0]],
  2: [[-0.42, 0.12], [0.42, -0.18]],
  3: [[0, 0.2], [-0.56, -0.22], [0.56, -0.22]],
};

function viewTargetPos(v) {
  const p = board.unitPosition(v.path, v.row);
  const side = v.group.userData.side;
  const mates = [...unitViews.values()]
    .filter((o) => o.path === v.path && o.row === v.row && o.group.userData.side === side)
    .sort((a, b) => {
      const aa = battle?.units.get(a.group.userData.uid)?.arrival ?? a.group.userData.uid;
      const bb = battle?.units.get(b.group.userData.uid)?.arrival ?? b.group.userData.uid;
      return aa - bb;
    });
  const slots = STACK_SLOTS[Math.min(mates.length, 3)] || STACK_SLOTS[3];
  const idx = Math.min(Math.max(mates.indexOf(v), 0), slots.length - 1);
  const [dx, dz] = slots[idx];
  const dir = side === 'player' ? 1 : -1;
  p.x += dx;
  p.z += dz * dir;
  if (isContested(v)) p.z += side === 'player' ? -0.5 : 0.5;
  return p;
}

// Ease every unit whose resting spot changed (a foe arrived or fell) into its
// stance. Skipped for any unit that starts a newer animation mid-settle.
function settleUnits() {
  for (const v of unitViews.values()) {
    const target = viewTargetPos(v);
    if (v.group.position.distanceToSquared(target) < 0.004) continue;
    const from = v.group.position.clone();
    const gen = ++v.moveGen;
    tweens.run({
      duration: 0.3,
      ease: Ease.inOutCubic,
      onUpdate: (e) => {
        if (v.moveGen !== gen) return;
        v.group.position.lerpVectors(from, target, e);
      },
    });
  }
}

function setViewHp(uid, hp) {
  const v = unitViews.get(uid);
  if (!v) return;
  v.hp = hp;
  drawHpBar(v.group.userData.hpBar, hp, v.maxHp);
}

async function animateMove(uid, to, tk = false) {
  const v = unitViews.get(uid);
  if (!v) return;
  const from = v.group.position.clone();
  v.path = to.path;
  v.row = to.row;
  const dest = viewTargetPos(v);
  v.moveGen++;
  if (tk) {
    // Telekinetic arc: lifted by an unseen hand, wreathed in violet. The
    // carried unit takes one full spin that lands exactly on its true combat
    // facing — never a stray accumulated angle (units used to come out of a
    // throw facing the wrong way).
    const glow = new THREE.PointLight(COLORS.kinaetic, 30, 6, 2);
    v.group.add(glow);
    const startRot = v.group.rotation.y;
    const baseFacing = v.group.userData.baseFacing || 0;
    const endRot = baseFacing + Math.PI * 2;
    await tweens.run({
      duration: 0.75,
      ease: Ease.inOutCubic,
      onUpdate: (e) => {
        v.group.position.lerpVectors(from, dest, e);
        v.group.position.y += Math.sin(e * Math.PI) * 1.7;
        v.group.rotation.y = startRot + (endRot - startRot) * e;
      },
    });
    v.group.rotation.y = baseFacing;
    v.group.remove(glow);
  } else {
    await tweens.run({
      duration: 0.4,
      ease: Ease.inOutCubic,
      onUpdate: (e) => {
        v.group.position.lerpVectors(from, dest, e);
        v.group.position.y += Math.sin(e * Math.PI) * 0.28;
      },
    });
  }
  v.group.position.copy(dest);
}

async function animateAttack(uid, targetUid, dmg, targetHp) {
  const a = unitViews.get(uid);
  const t = unitViews.get(targetUid);
  if (a && t) {
    const start = a.group.position.clone();
    const dir = t.group.position.clone().sub(start);
    if (dir.lengthSq() < 0.01) dir.set(0, 0, a.group.userData.side === 'player' ? 1 : -1);
    dir.normalize().multiplyScalar(0.55);
    await tweens.run({
      duration: 0.3,
      ease: Ease.outCubic,
      onUpdate: (e) => {
        const k = Math.sin(e * Math.PI);
        a.group.position.set(start.x + dir.x * k, start.y + 0.2 * k, start.z + dir.z * k);
      },
    });
    a.group.position.copy(start);
  }
  if (t) {
    const label = dmg === 0 ? 'warded' : `-${dmg}`;
    floatText(world.scene, tweens, t.group.position.clone().add(new THREE.Vector3(0, 1.6, 0)), label, dmg === 0 ? '#59f0c8' : '#ff7a6b');
    setViewHp(targetUid, targetHp);
    world.addShake(0.12);
  }
}

async function animateShoot(uid, targetUid, dmg, targetHp) {
  const a = unitViews.get(uid);
  const t = unitViews.get(targetUid);
  if (a && t) {
    const from = a.group.position.clone().add(new THREE.Vector3(0, 1.3, 0));
    const to = t.group.position.clone().add(new THREE.Vector3(0, 1, 0));
    const isPlayer = a.group.userData.side === 'player';
    const bolt = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 8, 6),
      new THREE.MeshBasicMaterial({ color: isPlayer ? COLORS.kinaeticGlow : 0xffcf7a })
    );
    bolt.position.copy(from);
    world.scene.add(bolt);
    await tweens.run({
      duration: 0.4,
      ease: Ease.linear,
      onUpdate: (e) => {
        bolt.position.lerpVectors(from, to, e);
        bolt.position.y += Math.sin(e * Math.PI) * 0.8;
      },
    });
    world.scene.remove(bolt);
  }
  if (t) {
    const label = dmg === 0 ? 'warded' : `-${dmg}`;
    floatText(world.scene, tweens, t.group.position.clone().add(new THREE.Vector3(0, 1.6, 0)), label, dmg === 0 ? '#59f0c8' : '#ff7a6b');
    setViewHp(targetUid, targetHp);
  }
}

async function animateDeath(uid) {
  const v = unitViews.get(uid);
  if (!v) return;
  unitViews.delete(uid);
  v.moveGen++;
  await tweens.run({
    duration: 0.45,
    ease: Ease.inOutCubic,
    onUpdate: (e) => {
      v.group.scale.setScalar(Math.max(0.01, 1 - e));
      v.group.rotation.y += 0.15;
      v.group.position.y = board.unitPosition(v.path, v.row).y + e * 0.6;
    },
  });
  world.scene.remove(v.group);
}

// ---------------------------------------------------------------------------
// battle event animation

// Camera pans up to frame the portal while Kinaeto speaks; the hand of cards
// tucks away and the dialogue box docks beneath him.
async function kinaetoSpeaks(lines) {
  const cardsWereVisible = cardHand.group.visible;
  cardHand.group.visible = false;
  world.focusTarget = 1;
  hud.setDialogueDock(true);
  await kinaeto.emerge();
  await hud.dialogue(lines);
  await kinaeto.retreat();
  hud.setDialogueDock(false);
  world.focusTarget = 0;
  cardHand.group.visible = cardsWereVisible;
}

// Animate a single battle event. Batched clash events run through here
// concurrently, so nothing in each case may assume it runs alone.
async function animateEvent(ev) {
  {
    switch (ev.type) {
      case 'burn': {
        hud.setImpetus(ev.impetus, RULES.impetusPerTurn);
        cardHand.setAffordable(ev.impetus);
        hud.setCounts(battle.deck.length, battle.discard.length);
        hud.toast('The flames take it — +1 Impetus');
        await sleep(200);
        break;
      }
      case 'turnStart': {
        hud.setTurn(ev.turn);
        hud.setImpetus(ev.impetus, ev.impetusMax);
        hud.setKinaetic(ev.kinaetic);
        cardHand.setHand(ev.hand, ev.impetus);
        hud.setCounts(battle.deck.length, battle.discard.length);
        for (const it of ev.intents || []) {
          const v = unitViews.get(it.uid);
          if (v) setIntent(v.group, it.intent);
        }
        await sleep(250);
        break;
      }
      case 'gaze': {
        board.setGaze(ev.path, ev.next);
        hud.setGaze(PATH_NAMES[ev.path], PATH_NAMES[ev.next]);
        await sleep(150);
        break;
      }
      case 'gazeFavor': {
        hud.toast('The Eye approves — your focus is preserved');
        break;
      }
      case 'ward': {
        const v = unitViews.get(ev.uid);
        if (v) {
          floatText(world.scene, tweens, v.group.position.clone().add(new THREE.Vector3(0, 1.6, 0)), `+${ev.amount} ward`, '#59f0c8');
        }
        await sleep(150);
        break;
      }
      case 'rage': {
        const v = unitViews.get(ev.uid);
        if (v) {
          floatText(world.scene, tweens, v.group.position.clone().add(new THREE.Vector3(0, 1.9, 0)), '+1 ⚔', '#ff8a5c');
        }
        break;
      }
      case 'sap': {
        // the Cinder Chorus sings the fight out of them
        const v = unitViews.get(ev.uid);
        if (v) {
          floatText(world.scene, tweens, v.group.position.clone().add(new THREE.Vector3(0, 1.9, 0)), '−1 ⚔', '#9fb8e8');
        }
        break;
      }
      case 'emberBurst': {
        const v = unitViews.get(ev.targetUid);
        if (v) {
          floatText(world.scene, tweens, v.group.position.clone().add(new THREE.Vector3(0, 1.7, 0)), `ember -${ev.dmg}`, '#ffb46b');
          setViewHp(ev.targetUid, ev.targetHp);
          world.addShake(0.15);
        }
        await sleep(200);
        break;
      }
      case 'draw': {
        // Kinaeto's Beckoning — fresh cards rise into the fan
        cardHand.setHand(ev.hand, battle.impetus);
        hud.setCounts(battle.deck.length, battle.discard.length);
        await sleep(350);
        break;
      }
      case 'place': {
        const unit = ev.unit;
        const group = addUnitView(unit);
        const dest = viewTargetPos(unitViews.get(unit.uid));
        group.position.copy(dest);
        await tweens.run({
          duration: 0.45,
          ease: Ease.outBack,
          onUpdate: (e) => {
            group.position.y = dest.y + (1 - e) * 2.6;
            group.scale.setScalar(Math.max(0.01, e));
          },
        });
        settleUnits();
        break;
      }
      case 'warn': {
        board.setWarnings(ev.paths);
        const names = ev.paths.map((p) => PATH_NAMES[p]).join(' & ');
        hud.banner(
          ev.isBoss ? `⚜ THE SAINT-COMMANDER COMES — ${names} PATH ⚜` : `THE CRUSADE STIRS — ${names} PATH${ev.paths.length > 1 ? 'S' : ''}`,
          ev.isBoss ? 'boss' : 'warn'
        );
        // A null entry means this warning was already folded into an earlier
        // dialogue (battle one's first warn rides along with the intro) — the
        // banner and path sigils carry it, no second camera trip to Kinaeto.
        const line = warnLines[warnCount];
        warnCount++;
        if (line) await kinaetoSpeaks([line]);
        break;
      }
      case 'spawn': {
        board.clearWarnings();
        const unit = ev.unit;
        const group = addUnitView(unit, true);
        const dest = viewTargetPos(unitViews.get(unit.uid));
        const from = group.position.clone();
        if (ev.isBoss) {
          hud.banner(`⚜ ${unit.name.toUpperCase()} ⚜`, 'boss');
          world.addShake(0.4);
        }
        await tweens.run({
          duration: ev.isBoss ? 1.1 : 0.55,
          ease: Ease.outCubic,
          onUpdate: (e) => {
            group.position.lerpVectors(from, dest, e);
            group.position.y = dest.y + Math.abs(Math.sin(e * Math.PI * 2)) * 0.15;
          },
        });
        if (ev.isBoss && state === 'battle') await kinaetoSpeaks([DIALOGUE.bossSpawn]);
        hud.setWave(`Wave ${battle.wavesSpawned} / ${battle.def.waves.length}`);
        settleUnits();
        break;
      }
      case 'move':
        await animateMove(ev.uid, ev.to, ev.tk);
        settleUnits();
        break;
      case 'attack':
        await animateAttack(ev.uid, ev.targetUid, ev.dmg, ev.targetHp);
        break;
      case 'shoot':
        await animateShoot(ev.uid, ev.targetUid, ev.dmg, ev.targetHp);
        break;
      case 'die':
        await animateDeath(ev.uid);
        settleUnits();
        break;
      case 'obeliskHit': {
        world.addShake(0.35);
        hud.setObelisk(ev.hp, battle.obeliskMaxHp);
        floatText(
          world.scene,
          tweens,
          new THREE.Vector3(OBELISK_POS.x, 6.5, OBELISK_POS.z),
          `-${ev.dmg}`,
          '#ff5b4d'
        );
        await sleep(300);
        break;
      }
      case 'bossAbility': {
        hud.banner('CONSECRATION', 'boss');
        const v = unitViews.get(ev.uid);
        if (v) {
          const beam = new THREE.Mesh(
            new THREE.BoxGeometry(2.4, 0.1, rowZ(ROWS - 1) - rowZ(0) + 2),
            new THREE.MeshBasicMaterial({ color: 0xffd970, transparent: true, opacity: 0 })
          );
          beam.position.set(v.group.position.x, 0.5, (rowZ(0) + rowZ(ROWS - 1)) / 2);
          world.scene.add(beam);
          await tweens.run({
            duration: 0.8,
            ease: Ease.inOutCubic,
            onUpdate: (e) => {
              beam.material.opacity = Math.sin(e * Math.PI) * 0.5;
            },
          });
          world.scene.remove(beam);
        }
        for (const victim of ev.victims) {
          const vv = unitViews.get(victim.uid);
          if (vv) {
            floatText(world.scene, tweens, vv.group.position.clone().add(new THREE.Vector3(0, 1.6, 0)), `-${victim.dmg}`, '#ffd970');
            setViewHp(victim.uid, victim.hp);
          }
        }
        await sleep(250);
        break;
      }
      case 'crush': {
        const v = unitViews.get(ev.uid);
        if (v) {
          floatText(world.scene, tweens, v.group.position.clone().add(new THREE.Vector3(0, 1.8, 0)), `-${ev.dmg}`, '#c9a6ff');
          setViewHp(ev.uid, ev.hp);
          world.addShake(0.25);
          await tweens.run({
            duration: 0.5,
            ease: Ease.inOutCubic,
            onUpdate: (e) => {
              const k = 1 - Math.sin(e * Math.PI) * 0.55;
              v.group.scale.set(1 / Math.sqrt(k), k, 1 / Math.sqrt(k));
            },
          });
          v.group.scale.setScalar(1);
        }
        break;
      }
      case 'trip': {
        const v = unitViews.get(ev.uid);
        if (v) {
          floatText(world.scene, tweens, v.group.position.clone().add(new THREE.Vector3(0, 1.8, 0)), 'TRIPPED', '#c9a6ff');
          await tweens.run({
            duration: 0.6,
            ease: Ease.outCubic,
            onUpdate: (e) => {
              v.group.rotation.x = Math.sin(e * Math.PI) * 1.1;
            },
          });
          v.group.rotation.x = 0;
        }
        break;
      }
      case 'stunned': {
        const v = unitViews.get(ev.uid);
        if (v) {
          floatText(world.scene, tweens, v.group.position.clone().add(new THREE.Vector3(0, 1.8, 0)), '✦ dazed ✦', '#a8a0b8');
          await sleep(200);
        }
        break;
      }
      case 'doomStun': {
        // The Inquisitor's Judgement: the faithful drop where they stand.
        const v = unitViews.get(ev.uid);
        if (v) {
          floatText(world.scene, tweens, v.group.position.clone().add(new THREE.Vector3(0, 1.8, 0)), '✦ STILLED ✦', '#ffd970');
          await tweens.run({
            duration: 0.5,
            ease: Ease.outCubic,
            onUpdate: (e) => {
              v.group.rotation.x = e * 1.25;
            },
          });
        }
        break;
      }
      case 'obeliskShatter': {
        hud.setObelisk(0, battle.obeliskMaxHp);
        world.addShake(0.6);
        await world.shatterObelisk(tweens);
        await sleep(400);
        break;
      }
    }
  }
}

async function processEvents(events) {
  setMode('busy');
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (ev.type === 'win') {
      await sleep(400);
      await kinaetoSpeaks(DIALOGUE.victory);
      metaState.battlesWon = Math.max(metaState.battlesWon || 0, 1);
      saveMeta(metaState);
      hud.showScreen('victory', () => enterHub());
      return;
    }
    if (ev.type === 'lose') {
      // In the tutorial, the loss belongs to the script — the dream follows.
      if (state === 'tutorial') return;
      world.addShake(0.6);
      await sleep(500);
      await kinaetoSpeaks(DIALOGUE.defeat);
      hud.showScreen('defeat', () => enterHub());
      return;
    }
    if (ev.batch) {
      // Skirmish pacing: everything in one tile's clash plays as a single
      // overlapping brawl instead of one blow at a time.
      const group = [ev];
      while (i + 1 < events.length && events[i + 1].batch === ev.batch) group.push(events[++i]);
      let delay = 0;
      const running = group.map((e) => {
        const d = delay;
        delay += 100;
        return (async () => {
          await sleep(d);
          await animateEvent(e);
        })();
      });
      await Promise.all(running);
      settleUnits();
      await sleep(150);
      continue;
    }
    await animateEvent(ev);
    await sleep(110);
  }
  refreshHud();
  setMode('idle');
  if (tutorial && tutorial.active) await tutorial.afterEvents();
}

// ---------------------------------------------------------------------------
// executing card actions (shared by direct drops and the USE-zone flow)

function executePlace(path, row) {
  const result = battle.playCard(dragIndex, path, row);
  if (!result.ok) {
    hud.toast(result.reason);
    cancelAction();
    return;
  }
  cardHand.removeCardVisual(dragIndex);
  dragIndex = -1;
  dragIsRite = false;
  setMode('busy');
  tutorial?.noteAction('placeCard');
  processEvents(result.events);
}

function executeRite(targetUid) {
  const result = battle.playTkCard(dragIndex, targetUid);
  if (!result.ok) {
    hud.toast(result.reason);
    cancelAction();
    return;
  }
  cardHand.removeCardVisual(dragIndex);
  dragIndex = -1;
  dragIsRite = false;
  setMode('busy');
  tutorial?.noteAction('rite');
  processEvents(result.events);
}

function executeBurn() {
  const result = battle.burnCard(dragIndex);
  if (!result.ok) {
    hud.toast(result.reason);
    cancelAction();
    return;
  }
  cardHand.removeCardVisual(dragIndex);
  dragIndex = -1;
  dragIsRite = false;
  setMode('busy');
  tutorial?.noteAction('burn');
  processEvents(result.events);
}

// A pressed unit becomes a telekinetic drag once the pointer travels far
// enough; a press released in place is an inspection click instead.
function tryStartUnitDrag() {
  const press = unitPress;
  unitPress = null;
  const u = battle.units.get(press.uid);
  if (!u) return;
  if (!gateAllows('tk', { uid: press.uid, side: u.side })) return;
  const check = battle.canTkGrab(press.uid);
  if (!check.ok) {
    hud.toast(check.reason);
    return;
  }
  tkOptions = battle.tkMoveOptions(press.uid);
  if (tkOptions.length === 0) {
    hud.toast('No tile within Kinaeto’s reach');
    return;
  }
  tkUid = press.uid;
  hud.hideUnitTip();
  setMode('tkSelect');
  // adjacent tiles (Move) glow teal; the far throws (Push) glow violet
  board.highlight(tkOptions.filter((o) => o.power === 'move'), COLORS.eldritch);
  board.highlight(tkOptions.filter((o) => o.power === 'push'), COLORS.kinaetic);
}

// ---------------------------------------------------------------------------
// input

window.addEventListener('pointermove', (e) => {
  setPointer(e);
  if (state === 'hub') {
    hub.onPointerMove(raycaster);
    return;
  }
  if (!battle || battle.over) return;
  cardHand.setPointerNDC(pointer.x, pointer.y);
  // Vertical glance: cursor near the hand peeks at the path mouths and their
  // warning sigils; cursor near the top frames the full obelisk.
  if (mode === 'idle' && world.sideTarget === 0) {
    if (pointer.y < -0.3) world.glanceTarget = -Math.min(1, (-pointer.y - 0.3) / 0.2);
    else if (pointer.y > 0.45) world.glanceTarget = Math.min(1, (pointer.y - 0.45) / 0.35);
    else world.glanceTarget = 0;
  } else {
    world.glanceTarget = 0;
  }

  if (mode === 'idle') {
    // a pressed unit turns into a telekinetic drag once it travels far enough
    if (unitPress) {
      const dx = e.clientX - unitPress.x;
      const dy = e.clientY - unitPress.y;
      if (dx * dx + dy * dy > 196) tryStartUnitDrag();
      return;
    }
    // The fan's slot band is generous, but units near the path mouths share
    // that space — a unit under the cursor outranks a slot the raycast
    // doesn't confirm.
    const slot = cardHand.slotIndexAt();
    let hoverIdx = -1;
    let unitObj = null;
    if (slot >= 0) {
      const picked = pickCard();
      if (picked) hoverIdx = picked.userData.index;
      else {
        unitObj = hud.inspectOpen ? null : pickUnit();
        if (!unitObj) hoverIdx = slot;
      }
    } else {
      unitObj = hud.inspectOpen ? null : pickUnit();
    }
    cardHand.setHover(hoverIdx);
    if (hoverIdx >= 0) {
      hud.hideUnitTip();
      document.body.style.cursor = 'grab';
      return;
    }
    // no card underfoot — units explain themselves on hover
    if (unitObj) {
      const u = battle.units.get(unitObj.userData.uid);
      if (u) hud.showUnitTip(unitTipText(u), e.clientX, e.clientY);
      document.body.style.cursor = 'pointer';
    } else {
      hud.hideUnitTip();
      document.body.style.cursor = 'default';
    }
  } else if (mode === 'dragCard') {
    board.clearHover();
    ghost.visible = false;
    const zone = hud.zoneAt(e.clientX, e.clientY);
    hud.setZoneHot('use', zone === 'use');
    hud.setZoneHot('burn', zone === 'burn');
    if (zone) {
      document.body.style.cursor = 'grabbing';
      return;
    }
    if (dragIsRite) {
      const unit = pickUnit();
      document.body.style.cursor = unit ? 'pointer' : 'grabbing';
      if (unit) {
        const v = unitViews.get(unit.userData.uid);
        if (v) {
          ghost.position.copy(v.group.position);
          ghost.position.y += 0.15;
          ghost.visible = true;
        }
      }
    } else {
      const tile = pickTile();
      if (tile && battle.canPlaceCard(dragIndex, tile.userData.path, tile.userData.row).ok) {
        board.hoverTile(tile);
        ghost.position.set(tile.position.x, tile.position.y + 0.2, tile.position.z);
        ghost.visible = true;
      }
    }
  } else if (mode === 'placeTarget') {
    board.clearHover();
    ghost.visible = false;
    const tile = pickTile();
    if (tile && battle.canPlaceCard(dragIndex, tile.userData.path, tile.userData.row).ok) {
      board.hoverTile(tile);
      ghost.position.set(tile.position.x, tile.position.y + 0.2, tile.position.z);
      ghost.visible = true;
      document.body.style.cursor = 'pointer';
    } else {
      document.body.style.cursor = 'default';
    }
  } else if (mode === 'castTarget') {
    const unit = pickUnit();
    ghost.visible = false;
    document.body.style.cursor = unit ? 'pointer' : 'default';
    if (unit) {
      const v = unitViews.get(unit.userData.uid);
      if (v) {
        ghost.position.copy(v.group.position);
        ghost.position.y += 0.15;
        ghost.visible = true;
      }
    }
  } else if (mode === 'tkSelect') {
    const tile = pickTile();
    board.clearHover();
    if (tile && tkOptions.some((d) => d.path === tile.userData.path && d.row === tile.userData.row)) {
      board.hoverTile(tile);
      document.body.style.cursor = 'pointer';
    } else {
      document.body.style.cursor = 'default';
    }
  }
});

window.addEventListener('pointerdown', (e) => {
  if (e.button === 2) return;
  setPointer(e);
  // While Kinaeto is speaking, any click just advances his dialogue — the
  // world (and the hidden card fan) can't be poked at behind his words.
  // (A click on the dialogue itself already advances via its own handler.)
  if (document.body.classList.contains('dialogue-open')) {
    if (!(e.target && e.target.closest && e.target.closest('#dialogue'))) hud.advanceDialogue();
    return;
  }
  if (state === 'hub') {
    hub.onPointerDown(raycaster);
    return;
  }
  if (!battle || battle.over) return;
  if (hud.inspectOpen) return; // the inspector's own click closes it

  if (mode === 'idle') {
    // Any card may be picked up — even one you cannot afford. Unplayable
    // cards can always feed the flames. A unit under the cursor outranks a
    // slot-band guess the card raycast doesn't confirm.
    const slot = cardHand.slotIndexAt();
    let card = null;
    if (slot >= 0) {
      const picked = pickCard();
      if (picked) card = cardHand.meshes[picked.userData.index];
      else if (!pickUnit()) card = cardHand.meshes[slot];
    }
    if (card) {
      if (!gateAllows('dragCard', { key: card.userData.key })) return;
      const def = battle.cards[card.userData.key];
      dragIsRite = def.type === 'tk';
      dragIndex = card.userData.index;
      cardHand.setDragging(dragIndex, true);
      hud.hideUnitTip();
      setMode('dragCard');
      if (!dragIsRite) board.highlight(validPlacementCells(dragIndex), COLORS.kinaetic);
      document.body.style.cursor = 'grabbing';
      return;
    }
    // a press on a unit: click = inspect, drag = telekinesis
    const unitObj = pickUnit();
    if (unitObj) unitPress = { uid: unitObj.userData.uid, x: e.clientX, y: e.clientY };
    return;
  }

  if (mode === 'placeTarget') {
    const tile = pickTile();
    if (tile) {
      const { path, row } = tile.userData;
      const key = cardHand.meshes[dragIndex]?.userData.key;
      if (!gateAllows('placeCard', { key, path, row })) return;
      const check = battle.canPlaceCard(dragIndex, path, row);
      if (check.ok) {
        executePlace(path, row);
      } else {
        hud.toast(check.reason);
      }
      return;
    }
    cancelAction();
    return;
  }

  if (mode === 'castTarget') {
    const unitObj = pickUnit();
    if (unitObj) {
      const key = cardHand.meshes[dragIndex]?.userData.key;
      const targetSide = battle.units.get(unitObj.userData.uid)?.side;
      if (!gateAllows('rite', { key, targetSide })) return;
      executeRite(unitObj.userData.uid);
      return;
    }
    cancelAction();
  }
});

window.addEventListener('pointerup', (e) => {
  if (state === 'hub' || !battle) return;
  setPointer(e);

  // a telekinetic drag resolves where it lets go
  if (mode === 'tkSelect' && tkUid !== null) {
    const tile = pickTile();
    document.body.style.cursor = 'default';
    if (tile && tkOptions.some((d) => d.path === tile.userData.path && d.row === tile.userData.row)) {
      const result = battle.applyTkMove(tkUid, { path: tile.userData.path, row: tile.userData.row });
      tkUid = null;
      tkOptions = [];
      if (result.ok) {
        tutorial?.noteAction('tkMove');
        processEvents(result.events);
      } else {
        hud.toast(result.reason);
        setMode('idle');
      }
    } else {
      cancelAction();
    }
    return;
  }

  // a unit pressed and released in place is an inspection click
  if (unitPress) {
    const uid = unitPress.uid;
    unitPress = null;
    if (mode === 'idle' && !hud.inspectOpen) inspectUnit(uid);
    return;
  }

  if (mode !== 'dragCard') return;
  document.body.style.cursor = 'default';

  const key = cardHand.meshes[dragIndex]?.userData.key;
  const def = key && battle.cards[key];
  const zone = hud.zoneAt(e.clientX, e.clientY);

  // the BURN brazier takes any card, playable or not
  if (zone === 'burn') {
    if (!gateAllows('burn', { key })) {
      cancelAction();
      return;
    }
    executeBurn();
    return;
  }

  // the USE circle: dock the card, then pick its target at leisure
  if (zone === 'use') {
    if (dragIsRite) {
      if (!battle.kinaeticAvailable()) {
        hud.toast('Kinaetic focus already spent this turn — burn it instead');
        cancelAction();
        return;
      }
      if (def.power === 'beckon') {
        if (!gateAllows('rite', { key })) {
          cancelAction();
          return;
        }
        executeRite();
        return;
      }
      cardHand.setDocked(dragIndex);
      setMode('castTarget');
      return;
    }
    const cells = validPlacementCells(dragIndex);
    if (!cells.length) {
      hud.toast(def && def.cost > battle.impetus ? 'Not enough Impetus — burn a card for more' : 'No tile can take it');
      cancelAction();
      return;
    }
    cardHand.setDocked(dragIndex);
    setMode('placeTarget');
    board.highlight(cells, COLORS.kinaetic);
    return;
  }

  // direct drops still work: straight onto a tile, a unit, or the open air
  if (dragIsRite) {
    if (def && def.power === 'beckon') {
      if (pointer.y > -0.45) {
        if (!gateAllows('rite', { key })) {
          cancelAction();
          return;
        }
        executeRite();
        return;
      }
    } else {
      const unitObj = pickUnit();
      if (unitObj) {
        const targetSide = battle.units.get(unitObj.userData.uid)?.side;
        if (!gateAllows('rite', { key, targetSide })) {
          cancelAction();
          return;
        }
        executeRite(unitObj.userData.uid);
        return;
      }
    }
    cancelAction();
    return;
  }

  const tile = pickTile();
  if (tile) {
    const { path, row } = tile.userData;
    if (!gateAllows('placeCard', { key, path, row })) {
      cancelAction();
      return;
    }
    const check = battle.canPlaceCard(dragIndex, path, row);
    if (check.ok) {
      executePlace(path, row);
      return;
    }
    hud.toast(check.reason);
  }
  cancelAction();
});

window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  cancelAction();
});

// Arrow keys toggle the fixed side views: stand at one wall, face the other.
// The same key again (or Escape) returns to the tactical view.
function toggleSideView(dir) {
  if (world.sideTarget === dir) world.sideTarget = 0;
  else if (world.sideTarget === 0) world.sideTarget = dir;
  else world.sideTarget = 0; // from the opposite side, come back to centre first
  world.glanceTarget = 0;
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (state === 'hub') {
      hub.closePanel();
      return;
    }
    world.sideTarget = 0;
    cancelAction();
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    if (state === 'hub') return;
    toggleSideView(e.key === 'ArrowLeft' ? -1 : 1);
  }
});

// Touch: a horizontal swipe across the centre of the view toggles side views.
let swipeStart = null;
window.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'touch' || mode !== 'idle' || state === 'hub') return;
  const nx = e.clientX / window.innerWidth;
  const ny = e.clientY / window.innerHeight;
  if (nx > 0.15 && nx < 0.85 && ny > 0.1 && ny < 0.72) {
    setPointer(e);
    if (!pickCard()) swipeStart = { x: e.clientX, y: e.clientY };
  }
});
window.addEventListener('pointerup', (e) => {
  if (!swipeStart || e.pointerType !== 'touch') return;
  const dx = e.clientX - swipeStart.x;
  const dy = e.clientY - swipeStart.y;
  swipeStart = null;
  if (Math.abs(dx) >= 70 && Math.abs(dy) <= Math.abs(dx) * 0.6 && mode === 'idle') {
    toggleSideView(dx < 0 ? -1 : 1);
  }
});

hud.onEndTurn = () => {
  // the anywhere-click-advances rule applies to the button too
  if (document.body.classList.contains('dialogue-open')) {
    hud.advanceDialogue();
    return;
  }
  if (mode !== 'idle') return;
  if (!gateAllows('endTurn', {})) return;
  cancelAction();
  tutorial?.noteAction('endTurn');
  const events = battle.endTurn();
  processEvents(events);
};

// ---------------------------------------------------------------------------
// game flow

// Card faces and wall carvings are canvas-drawn: make sure the runic font is
// in before anything renders text. Safe to call after every stage switch —
// it also re-strikes the wall carvings of the freshly built stage.
async function ensureFontAndCarvings() {
  try {
    await document.fonts.load('20px "Uncial Antiqua"');
    clearCardTextures();
    world.refreshWallCarvings();
  } catch (err) {
    // font failure falls back to serif — carry on
  }
}

// The First Night: sermon → crash → guided lessons → the Inquisitor → dream.
async function startTutorial() {
  hud.showScreen(null);
  state = 'tutorial';
  world.setStage('sanctum');
  board.setVisible(true);
  board.setTheme(BOARD_THEMES.sanctum);
  hud.setBattleUi(true);
  cardHand.group.visible = true;
  clearUnits();
  board.clearWarnings();
  setCardSource(null); // the tutorial teaches with the unforged cards
  await ensureFontAndCarvings();

  battle = new Battle(TUTORIAL_BATTLE, { deck: TUTORIAL_DECK, noShuffle: true });
  warnLines = [DIALOGUE.tutWave2Warn];
  warnCount = 0;
  refreshHud();
  setMode('busy');

  tutorial = new Tutorial({
    battle,
    board,
    hud,
    world,
    kinaeto,
    cardHand,
    tweens,
    unitViews,
    setIntent,
    kinaetoSpeaks,
    processEvents,
    addUnitView,
    settleUnits,
    setMode,
    onComplete: () => {
      tutorial = null;
      metaState.tutorialDone = true;
      saveMeta(metaState);
      enterHub();
    },
  });
  await tutorial.begin();
}

const hub = new Hub({
  world,
  board,
  hud,
  cardHand,
  meta: metaState,
  kinaetoSpeaks,
  onStartBattle: () => startBattleOne(),
});

function enterHub() {
  hud.showScreen(null);
  state = 'hub';
  battle = null;
  tutorial = null;
  clearUnits();
  setMode('menu');
  // panels draw card faces — make sure the runic font is in for them
  ensureFontAndCarvings();
  hub.enter();
}

// Battle one — the Lower Gate, fought with the deck and forgings from the hub.
async function startBattleOne() {
  hub.exit();
  hud.showScreen(null);
  state = 'battle';
  world.setStage('cave');
  board.setVisible(true);
  board.setTheme(BOARD_THEMES.cave);
  hud.setBattleUi(true);
  cardHand.group.visible = true;
  clearUnits();
  board.clearWarnings();
  const cards = effectiveCards(metaState);
  setCardSource(cards);
  await ensureFontAndCarvings();

  battle = new Battle(BATTLE_ONE, { deck: metaState.deck.slice(), cards });
  // The first wave's warning rides along with the intro — one visit to
  // Kinaeto, not two back-to-back camera trips. The null entry makes the
  // warn event itself banner-only.
  warnLines = [null, DIALOGUE.wave2Warn, DIALOGUE.wave3Warn, DIALOGUE.bossWarn];
  warnCount = 0;
  refreshHud();
  setMode('busy');
  await kinaetoSpeaks([...DIALOGUE.intro, DIALOGUE.wave1Warn]);
  await processEvents(battle.start());
}

// ---------------------------------------------------------------------------
// boot

// Something atmospheric behind the menu overlay.
world.setStage(metaState.tutorialDone ? 'hub' : 'sanctum');
board.setVisible(!metaState.tutorialDone);
board.setTheme(BOARD_THEMES.sanctum);

hud.showScreen(
  'menu',
  (key) => {
    if (key === 'tutorial') startTutorial();
    else enterHub();
  },
  { firstRun: !metaState.tutorialDone }
);

// Debug / test hook: inspect live state from the console. timeScale
// multiplies animation time (Playwright runs use it to offset slow
// software rendering).
window.__game = {
  timeScale: 1,
  get battle() { return battle; },
  get mode() { return mode; },
  get unitPress() { return unitPress; },
  get state() { return state; },
  get tutorial() { return tutorial; },
  hub,
  meta: metaState,
  unitViews,
  world,
  board,
  cardHand,
  _test: { addUnitView, settleUnits, viewTargetPos, isContested, startTutorial, enterHub, startBattleOne, pickCard, pickUnit, raycaster },
};

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05) * (window.__game.timeScale || 1);
  world.update(dt);
  board.update(dt);
  kinaeto.update(dt);
  cardHand.update(dt);
  tweens.update(dt);
  if (tutorial) tutorial.update(dt);
  for (const v of unitViews.values()) updateUnitGroup(v.group, dt);
  world.render();
}
animate();
