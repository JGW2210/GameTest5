// Bootstraps the world and conducts play: input modes (card dragging,
// telekinesis targeting), and sequential animation of battle engine events.

import * as THREE from 'three';
import { World } from './scene.js';
import { Board } from './board.js';
import { Kinaeto } from './kinaeto.js';
import { CardHand } from './cards3d.js';
import { Hud, PATH_NAMES } from './hud.js';
import { Battle } from './battle.js';
import { Tweens, Ease, sleep, floatText } from './effects.js';
import { createUnitGroup, updateUnitGroup, drawHpBar } from './units.js';
import { BATTLE_ONE, DIALOGUE, CARDS } from './data.js';
import { RULES, PATHS, ROWS, COLORS, OBELISK_POS, rowZ } from './config.js';

const canvas = document.getElementById('game');
const world = new World(canvas);
const tweens = new Tweens();
const board = new Board(world.scene);
const kinaeto = new Kinaeto(world.scene, tweens);
const cardHand = new CardHand(world.camera);
const hud = new Hud();

let battle = null;
let mode = 'menu'; // menu | idle | dragCard | tkPickUnit | tkPickDest | busy
let dragIndex = -1;
let tkPower = null;
let tkTargetUid = null;
let tkDests = [];
let warnCount = 0;

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

function validPlacementCells(handIndex) {
  const cells = [];
  for (let p = 0; p < PATHS; p++) {
    for (let r = 0; r < ROWS; r++) {
      if (battle.canPlaceCard(handIndex, p, r).ok) cells.push({ path: p, row: r });
    }
  }
  return cells;
}

function refreshHud() {
  hud.setTurn(battle.turn);
  hud.setWave(`Wave ${battle.wavesSpawned} / ${battle.def.waves.length}`);
  hud.setEnergy(battle.energy, battle.maxEnergy);
  hud.setObelisk(battle.obeliskHp, battle.obeliskMaxHp);
  hud.setCounts(battle.deck.length, battle.discard.length);
  hud.setTk(battle.tkUsed, RULES.telekinesisPerTurn, tkPower);
  cardHand.setAffordable(battle.energy);
}

function setMode(next) {
  mode = next;
  board.clearHighlights();
  ghost.visible = false;
  if (next !== 'idle') world.glanceTarget = 0;
  const hints = {
    idle: 'Drag a card onto a glowing tile — or channel a telekinetic power from the right panel.',
    dragCard: 'Drop the follower on a glowing tile.',
    tkPickUnit: `Choose a target for ${tkPower ? tkPower.toUpperCase() : ''} — right-click to cancel.`,
    tkPickDest: 'Choose a destination tile — right-click to cancel.',
    busy: '',
    menu: '',
  };
  hud.setHint(hints[next] || '');
  hud.setEndTurnEnabled(next === 'idle');
}

function cancelAction() {
  if (mode === 'dragCard') cardHand.setDragging(dragIndex, false);
  dragIndex = -1;
  tkPower = null;
  tkTargetUid = null;
  tkDests = [];
  if (mode !== 'busy' && mode !== 'menu') setMode('idle');
  if (battle) hud.setTk(battle.tkUsed, RULES.telekinesisPerTurn, null);
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
  });
  return group;
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
  const dest = board.unitPosition(to.path, to.row);
  v.path = to.path;
  v.row = to.row;
  if (tk) {
    // Telekinetic arc: lifted by an unseen hand, wreathed in violet.
    const glow = new THREE.PointLight(COLORS.kinaetic, 30, 6, 2);
    v.group.add(glow);
    await tweens.run({
      duration: 0.75,
      ease: Ease.inOutCubic,
      onUpdate: (e) => {
        v.group.position.lerpVectors(from, dest, e);
        v.group.position.y += Math.sin(e * Math.PI) * 1.7;
        v.group.rotation.y += 0.06;
      },
    });
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
    floatText(world.scene, tweens, t.group.position.clone().add(new THREE.Vector3(0, 1.6, 0)), `-${dmg}`, '#ff7a6b');
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
    floatText(world.scene, tweens, t.group.position.clone().add(new THREE.Vector3(0, 1.6, 0)), `-${dmg}`, '#ff7a6b');
    setViewHp(targetUid, targetHp);
  }
}

async function animateDeath(uid) {
  const v = unitViews.get(uid);
  if (!v) return;
  unitViews.delete(uid);
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

const WARN_LINES = [DIALOGUE.wave1Warn, DIALOGUE.wave2Warn, DIALOGUE.wave3Warn, DIALOGUE.bossWarn];

// Camera pans up to frame the portal while Kinaeto speaks; the hand of cards
// tucks away and the dialogue box docks beneath him.
async function kinaetoSpeaks(lines) {
  cardHand.group.visible = false;
  world.focusTarget = 1;
  hud.setDialogueDock(true);
  await kinaeto.emerge();
  await hud.dialogue(lines);
  await kinaeto.retreat();
  hud.setDialogueDock(false);
  world.focusTarget = 0;
  cardHand.group.visible = true;
}

async function processEvents(events) {
  setMode('busy');
  for (const ev of events) {
    switch (ev.type) {
      case 'turnStart': {
        hud.setTurn(ev.turn);
        hud.setEnergy(ev.energy, ev.maxEnergy);
        cardHand.setHand(ev.hand, ev.energy);
        hud.setCounts(battle.deck.length, battle.discard.length);
        await sleep(250);
        break;
      }
      case 'place': {
        const unit = ev.unit;
        const group = addUnitView(unit);
        const dest = board.unitPosition(unit.path, unit.row);
        await tweens.run({
          duration: 0.45,
          ease: Ease.outBack,
          onUpdate: (e) => {
            group.position.y = dest.y + (1 - e) * 2.6;
            group.scale.setScalar(Math.max(0.01, e));
          },
        });
        break;
      }
      case 'warn': {
        board.setWarnings(ev.paths);
        const names = ev.paths.map((p) => PATH_NAMES[p]).join(' & ');
        hud.banner(
          ev.isBoss ? `⚜ THE SAINT-COMMANDER COMES — ${names} PATH ⚜` : `THE CRUSADE STIRS — ${names} PATH${ev.paths.length > 1 ? 'S' : ''}`,
          ev.isBoss ? 'boss' : 'warn'
        );
        const line = WARN_LINES[Math.min(warnCount, WARN_LINES.length - 1)];
        warnCount++;
        await kinaetoSpeaks([line]);
        break;
      }
      case 'spawn': {
        board.clearWarnings();
        const unit = ev.unit;
        const group = addUnitView(unit, true);
        const dest = board.unitPosition(unit.path, unit.row);
        const from = group.position.clone();
        if (ev.isBoss) {
          hud.banner('⚜ SAINT-COMMANDER AUREL ⚜', 'boss');
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
        if (ev.isBoss) await kinaetoSpeaks([DIALOGUE.bossSpawn]);
        hud.setWave(`Wave ${battle.wavesSpawned} / ${battle.def.waves.length}`);
        break;
      }
      case 'move':
        await animateMove(ev.uid, ev.to, ev.tk);
        break;
      case 'attack':
        await animateAttack(ev.uid, ev.targetUid, ev.dmg, ev.targetHp);
        break;
      case 'shoot':
        await animateShoot(ev.uid, ev.targetUid, ev.dmg, ev.targetHp);
        break;
      case 'die':
        await animateDeath(ev.uid);
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
      case 'win': {
        await sleep(400);
        await kinaetoSpeaks(DIALOGUE.victory);
        hud.showScreen('victory', () => location.reload());
        return;
      }
      case 'lose': {
        world.addShake(0.6);
        await sleep(500);
        await kinaetoSpeaks(DIALOGUE.defeat);
        hud.showScreen('defeat', () => location.reload());
        return;
      }
    }
    await sleep(110);
  }
  refreshHud();
  setMode('idle');
}

// ---------------------------------------------------------------------------
// input

window.addEventListener('pointermove', (e) => {
  if (!battle || battle.over) return;
  setPointer(e);
  cardHand.setPointerNDC(pointer.x, pointer.y);
  // Vertical glance: cursor near the hand peeks at the path mouths and their
  // warning sigils; cursor near the top frames the full obelisk.
  if (mode === 'idle') {
    if (pointer.y < -0.4) world.glanceTarget = -Math.min(1, (-pointer.y - 0.4) / 0.35);
    else if (pointer.y > 0.45) world.glanceTarget = Math.min(1, (pointer.y - 0.45) / 0.35);
    else world.glanceTarget = 0;
  } else {
    world.glanceTarget = 0;
  }
  if (mode === 'idle') {
    const card = pickCard();
    cardHand.setHover(card ? card.userData.index : -1);
    document.body.style.cursor = card ? 'grab' : 'default';
  } else if (mode === 'dragCard') {
    const tile = pickTile();
    board.clearHover();
    ghost.visible = false;
    if (tile && battle.canPlaceCard(dragIndex, tile.userData.path, tile.userData.row).ok) {
      board.hoverTile(tile);
      ghost.position.set(tile.position.x, tile.position.y + 0.2, tile.position.z);
      ghost.visible = true;
    }
  } else if (mode === 'tkPickUnit') {
    const unit = pickUnit();
    document.body.style.cursor = unit ? 'pointer' : 'default';
  } else if (mode === 'tkPickDest') {
    const tile = pickTile();
    board.clearHover();
    if (tile && tkDests.some((d) => d.path === tile.userData.path && d.row === tile.userData.row)) {
      board.hoverTile(tile);
    }
  }
});

window.addEventListener('pointerdown', (e) => {
  if (!battle || battle.over || e.button === 2) return;
  setPointer(e);

  if (mode === 'idle') {
    const card = pickCard();
    if (card) {
      if (!card.userData.affordable) {
        hud.toast('Not enough Kinaetic energy');
        return;
      }
      dragIndex = card.userData.index;
      cardHand.setDragging(dragIndex, true);
      setMode('dragCard');
      board.highlight(validPlacementCells(dragIndex), COLORS.kinaetic);
      document.body.style.cursor = 'grabbing';
    }
  } else if (mode === 'tkPickUnit') {
    const unitObj = pickUnit();
    if (!unitObj) return;
    const uid = unitObj.userData.uid;
    const check = battle.canTkTarget(tkPower, uid);
    if (!check.ok) {
      hud.toast(check.reason);
      return;
    }
    if (tkPower === 'crush' || tkPower === 'trip') {
      const result = battle.applyTk(tkPower, uid);
      if (result.ok) {
        tkPower = null;
        processEvents(result.events);
      } else {
        hud.toast(result.reason);
      }
    } else {
      tkDests = battle.tkDestinations(tkPower, uid);
      if (tkDests.length === 0) {
        hud.toast('No tile within Kinaeto’s reach');
        return;
      }
      tkTargetUid = uid;
      setMode('tkPickDest');
      board.highlight(tkDests, COLORS.eldritch);
    }
  } else if (mode === 'tkPickDest') {
    const tile = pickTile();
    if (tile && tkDests.some((d) => d.path === tile.userData.path && d.row === tile.userData.row)) {
      const result = battle.applyTk(tkPower, tkTargetUid, {
        path: tile.userData.path,
        row: tile.userData.row,
      });
      tkPower = null;
      tkTargetUid = null;
      tkDests = [];
      if (result.ok) {
        processEvents(result.events);
      } else {
        hud.toast(result.reason);
        setMode('idle');
      }
    } else {
      cancelAction();
    }
  }
});

window.addEventListener('pointerup', (e) => {
  if (mode !== 'dragCard') return;
  setPointer(e);
  const tile = pickTile();
  document.body.style.cursor = 'default';
  if (tile) {
    const { path, row } = tile.userData;
    const check = battle.canPlaceCard(dragIndex, path, row);
    if (check.ok) {
      const result = battle.playCard(dragIndex, path, row);
      cardHand.removeCardVisual(dragIndex);
      dragIndex = -1;
      setMode('busy');
      processEvents(result.events);
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
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') cancelAction();
});

hud.onTkSelect = (power) => {
  if (mode !== 'idle' && mode !== 'tkPickUnit' && mode !== 'tkPickDest') return;
  if (!battle.tkAvailable()) {
    hud.toast('Telekinesis already used this turn');
    return;
  }
  tkPower = power;
  tkTargetUid = null;
  tkDests = [];
  setMode('tkPickUnit');
  hud.setTk(battle.tkUsed, RULES.telekinesisPerTurn, power);
};

hud.onEndTurn = () => {
  if (mode !== 'idle') return;
  cancelAction();
  const events = battle.endTurn();
  processEvents(events);
};

// ---------------------------------------------------------------------------
// boot

async function startBattle() {
  hud.showScreen(null);
  battle = new Battle(BATTLE_ONE);
  warnCount = 0;
  refreshHud();
  setMode('busy');
  await kinaetoSpeaks(DIALOGUE.intro);
  const events = battle.start();
  await processEvents(events);
}

hud.showScreen('menu', () => startBattle());

// Debug / test hook: inspect live state from the console.
window.__game = {
  get battle() { return battle; },
  get mode() { return mode; },
  unitViews,
  world,
  board,
  cardHand,
};

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  world.update(dt);
  board.update(dt);
  kinaeto.update(dt);
  cardHand.update(dt);
  tweens.update(dt);
  for (const v of unitViews.values()) updateUnitGroup(v.group, dt);
  world.render();
}
animate();
