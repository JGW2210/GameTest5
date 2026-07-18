// Bootstraps the world and conducts play: input modes (card dragging,
// telekinesis targeting), and sequential animation of battle engine events.

import * as THREE from 'three';
import { World } from './scene.js';
import { Board } from './board.js';
import { Kinaeto } from './kinaeto.js';
import { CardHand, clearCardTextures } from './cards3d.js';
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
let mode = 'menu'; // menu | idle | dragCard | tkSelect | busy
let dragIndex = -1;
let dragIsRite = false; // dragged card is a Kinaetic Rite (targets units)
let tkUid = null; // unit grabbed for a telekinetic move
let tkOptions = []; // {path,row,power} tiles Kinaeto can carry it to
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
  hud.setImpetus(battle.impetus, RULES.impetusPerTurn);
  hud.setKinaetic(battle.kinaeticAvailable());
  hud.setObelisk(battle.obeliskHp, battle.obeliskMaxHp);
  hud.setCounts(battle.deck.length, battle.discard.length);
  cardHand.setAffordable(battle.impetus);
}

function setMode(next) {
  mode = next;
  board.clearHighlights();
  ghost.visible = false;
  if (next !== 'idle') world.glanceTarget = 0;
  const hints = {
    idle: 'Drag a card to a glowing tile · click a unit to let Kinaeto move it',
    dragCard: dragIsRite ? 'Cast the rite on a unit' : 'Drop the follower on a glowing tile',
    tkSelect: 'Choose where the hand carries it — right-click to cancel',
    busy: '',
    menu: '',
  };
  hud.setHint(hints[next] || '');
  hud.setEndTurnEnabled(next === 'idle');
}

function cancelAction() {
  if (mode === 'dragCard') cardHand.setDragging(dragIndex, false);
  dragIndex = -1;
  dragIsRite = false;
  tkUid = null;
  tkOptions = [];
  if (mode !== 'busy' && mode !== 'menu') setMode('idle');
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

function viewTargetPos(v) {
  const p = board.unitPosition(v.path, v.row);
  if (isContested(v)) p.z += v.group.userData.side === 'player' ? -0.58 : 0.58;
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
        hud.setImpetus(ev.impetus, ev.impetusMax);
        hud.setKinaetic(ev.kinaetic);
        cardHand.setHand(ev.hand, ev.impetus);
        hud.setCounts(battle.deck.length, battle.discard.length);
        await sleep(250);
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
        const line = WARN_LINES[Math.min(warnCount, WARN_LINES.length - 1)];
        warnCount++;
        await kinaetoSpeaks([line]);
        break;
      }
      case 'spawn': {
        board.clearWarnings();
        const unit = ev.unit;
        const group = addUnitView(unit, true);
        const dest = viewTargetPos(unitViews.get(unit.uid));
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
  if (mode === 'idle' && world.sideTarget === 0) {
    // The downward glance bottoms out just ABOVE the card fan (~ -0.58), so
    // by the time the cursor reaches the cards the view is already settled
    // and a lifted card only covers what it is actually touching.
    if (pointer.y < -0.3) world.glanceTarget = -Math.min(1, (-pointer.y - 0.3) / 0.2);
    else if (pointer.y > 0.45) world.glanceTarget = Math.min(1, (pointer.y - 0.45) / 0.35);
    else world.glanceTarget = 0;
  } else {
    world.glanceTarget = 0;
  }
  if (mode === 'idle') {
    // Hover lives near the hand: pick by fan slot, and let the lifted card
    // keep hover only while the cursor stays in the lower band — wandering
    // up to the board always drops it, so it never blocks the view.
    let hoverIdx = cardHand.slotIndexAt();
    if (hoverIdx === -1 && pointer.y < -0.35 && cardHand.hoverIndex >= 0) {
      const card = pickCard();
      if (card && card.userData.index === cardHand.hoverIndex) hoverIdx = card.userData.index;
    }
    cardHand.setHover(hoverIdx);
    if (hoverIdx >= 0) {
      document.body.style.cursor = 'grab';
    } else {
      const unit = pickUnit();
      document.body.style.cursor = unit && battle.canTkGrab(unit.userData.uid).ok ? 'pointer' : 'default';
    }
  } else if (mode === 'dragCard') {
    board.clearHover();
    ghost.visible = false;
    if (dragIsRite) {
      const unit = pickUnit();
      document.body.style.cursor = unit ? 'pointer' : 'default';
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
  if (!battle || battle.over || e.button === 2) return;
  setPointer(e);

  if (mode === 'idle') {
    const slot = cardHand.slotIndexAt();
    let card = slot >= 0 ? cardHand.meshes[slot] : null;
    if (!card && pointer.y < -0.35 && cardHand.hoverIndex >= 0) {
      const picked = pickCard();
      if (picked && picked.userData.index === cardHand.hoverIndex) card = picked;
    }
    if (card) {
      const def = CARDS[card.userData.key];
      if (def.type === 'tk') {
        if (!battle.kinaeticAvailable()) {
          hud.toast('Kinaetic focus already spent this turn');
          return;
        }
        dragIsRite = true;
        dragIndex = card.userData.index;
        cardHand.setDragging(dragIndex, true);
        setMode('dragCard');
        hud.setHint(def.power === 'beckon' ? 'Release above the battlefield to beckon' : 'Cast the rite on a unit');
        return;
      }
      if (!card.userData.affordable) {
        hud.toast('Not enough Impetus');
        return;
      }
      dragIsRite = false;
      dragIndex = card.userData.index;
      cardHand.setDragging(dragIndex, true);
      setMode('dragCard');
      board.highlight(validPlacementCells(dragIndex), COLORS.kinaetic);
      document.body.style.cursor = 'grabbing';
      return;
    }
    // No card under the pointer — try grabbing a unit with Kinaeto's hand.
    const unitObj = pickUnit();
    if (unitObj) {
      const uid = unitObj.userData.uid;
      const check = battle.canTkGrab(uid);
      if (!check.ok) {
        hud.toast(check.reason);
        return;
      }
      tkOptions = battle.tkMoveOptions(uid);
      if (tkOptions.length === 0) {
        hud.toast('No tile within Kinaeto’s reach');
        return;
      }
      tkUid = uid;
      setMode('tkSelect');
      // adjacent tiles (Move) glow teal; the far throws (Push) glow violet
      board.highlight(tkOptions.filter((o) => o.power === 'move'), COLORS.eldritch);
      board.highlight(tkOptions.filter((o) => o.power === 'push'), COLORS.kinaetic);
    }
  } else if (mode === 'tkSelect') {
    const tile = pickTile();
    if (tile && tkOptions.some((d) => d.path === tile.userData.path && d.row === tile.userData.row)) {
      const result = battle.applyTkMove(tkUid, {
        path: tile.userData.path,
        row: tile.userData.row,
      });
      tkUid = null;
      tkOptions = [];
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
  document.body.style.cursor = 'default';

  if (dragIsRite) {
    const def = CARDS[cardHand.meshes[dragIndex]?.userData.key];
    if (def && def.power === 'beckon') {
      // released anywhere above the hand
      if (pointer.y > -0.45) {
        const result = battle.playTkCard(dragIndex);
        if (result.ok) {
          cardHand.removeCardVisual(dragIndex);
          dragIndex = -1;
          dragIsRite = false;
          setMode('busy');
          processEvents(result.events);
          return;
        }
        hud.toast(result.reason);
      }
    } else {
      const unitObj = pickUnit();
      if (unitObj) {
        const result = battle.playTkCard(dragIndex, unitObj.userData.uid);
        if (result.ok) {
          cardHand.removeCardVisual(dragIndex);
          dragIndex = -1;
          dragIsRite = false;
          setMode('busy');
          processEvents(result.events);
          return;
        }
        hud.toast(result.reason);
      }
    }
    cancelAction();
    return;
  }

  const tile = pickTile();
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
    world.sideTarget = 0;
    cancelAction();
  } else if (e.key === 'ArrowLeft') {
    toggleSideView(-1);
  } else if (e.key === 'ArrowRight') {
    toggleSideView(1);
  }
});

// Touch: a horizontal swipe across the centre of the view toggles side views.
let swipeStart = null;
window.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'touch' || mode !== 'idle') return;
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
  if (mode !== 'idle') return;
  cancelAction();
  const events = battle.endTurn();
  processEvents(events);
};

// ---------------------------------------------------------------------------
// boot

async function startBattle() {
  hud.showScreen(null);
  // Card faces and wall carvings are canvas-drawn: make sure the runic font
  // is in before anything renders text.
  try {
    await document.fonts.load('20px "Uncial Antiqua"');
    clearCardTextures();
    world.refreshWallCarvings();
  } catch (e) {
    // font failure falls back to serif — carry on
  }
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
  _test: { addUnitView, settleUnits, viewTargetPos, isContested },
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
