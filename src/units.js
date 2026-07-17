// Procedural low-poly unit meshes. Every unit is a THREE.Group whose
// userData carries {uid, isUnit:true} for raycasting, plus an HP bar sprite.

import * as THREE from 'three';
import { COLORS } from './config.js';

const mat = (color, opts = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1, flatShading: true, ...opts });

function robedFigure(robeColor, accentColor) {
  const g = new THREE.Group();
  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.15, 7), mat(robeColor));
  robe.position.y = 0.575;
  robe.castShadow = true;
  g.add(robe);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 8, 6), mat(0xd8c6a8));
  head.position.y = 1.22;
  g.add(head);
  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.42, 7), mat(accentColor));
  hood.position.y = 1.34;
  g.add(hood);
  return g;
}

function soldierFigure(scale = 1, { shield = false, crossbow = false, boss = false } = {}) {
  const g = new THREE.Group();
  const armor = boss ? COLORS.boss : COLORS.enemy;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.32), mat(armor, { metalness: 0.4, roughness: 0.5 }));
  torso.position.y = 0.75;
  torso.castShadow = true;
  g.add(torso);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.4, 0.28), mat(0x5a4a3a));
  legs.position.y = 0.2;
  g.add(legs);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), mat(0xd8c6a8));
  head.position.y = 1.28;
  g.add(head);
  const helm = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.22, 6), mat(COLORS.enemyAccent, { metalness: 0.6, roughness: 0.4 }));
  helm.position.y = 1.42;
  g.add(helm);
  // tabard cross of the church
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.02), mat(0xa8302a));
  crossV.position.set(0, 0.78, 0.18);
  g.add(crossV);
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.02), mat(0xa8302a));
  crossH.position.set(0, 0.86, 0.18);
  g.add(crossH);
  if (shield) {
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.28, 0.08, 6), mat(0x8a97a8, { metalness: 0.5 }));
    sh.rotation.x = Math.PI / 2;
    sh.position.set(0, 0.72, 0.34);
    g.add(sh);
  }
  if (crossbow) {
    const bow = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.08), mat(0x6a4a2a));
    bow.position.set(0, 0.95, 0.3);
    g.add(bow);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.34), mat(0x4a331e));
    stock.position.set(0, 0.95, 0.42);
    g.add(stock);
  }
  if (boss) {
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.045, 6, 18),
      new THREE.MeshStandardMaterial({ color: 0xffd970, emissive: 0xd4a017, emissiveIntensity: 1.4, roughness: 0.4 })
    );
    halo.position.y = 1.72;
    halo.rotation.x = Math.PI / 12;
    g.add(halo);
    const cape = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.95, 0.06), mat(0xe0e6ef));
    cape.position.set(0, 0.7, -0.22);
    g.add(cape);
  }
  g.scale.setScalar(scale);
  return g;
}

function houndFigure() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.75), mat(0x7a6a55));
  body.position.y = 0.42;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.32), mat(0x8a785e));
  head.position.set(0, 0.55, 0.5);
  g.add(head);
  for (const [x, z] of [[-0.11, 0.25], [0.11, 0.25], [-0.11, -0.25], [0.11, -0.25]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.32, 0.09), mat(0x655741));
    leg.position.set(x, 0.16, z);
    g.add(leg);
  }
  return g;
}

function makePlayerUnit(unit) {
  if (unit.type === 'object') {
    const g = new THREE.Group();
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), mat(COLORS.object));
    rock.position.y = 0.5;
    rock.rotation.set(0.4, 0.8, 0.2);
    rock.castShadow = true;
    g.add(rock);
    const rune = new THREE.Mesh(
      new THREE.TorusGeometry(0.3, 0.03, 6, 12),
      new THREE.MeshStandardMaterial({ color: COLORS.rune, emissive: COLORS.rune, emissiveIntensity: 1.2 })
    );
    rune.position.y = 0.55;
    rune.rotation.x = Math.PI / 2.4;
    g.add(rune);
    return g;
  }
  const colors = { palm: COLORS.palm, fist: COLORS.fist, sign: COLORS.sign };
  const g = robedFigure(colors[unit.type] || COLORS.palm, 0x241a2e);
  if (unit.type === 'sign') {
    const rune = new THREE.Mesh(
      new THREE.TetrahedronGeometry(0.16),
      new THREE.MeshStandardMaterial({ color: COLORS.rune, emissive: COLORS.rune, emissiveIntensity: 1.6 })
    );
    rune.position.y = 1.85;
    rune.userData.spin = true;
    g.add(rune);
  }
  if (unit.type === 'fist') {
    const brazier = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 6, 5),
      new THREE.MeshStandardMaterial({ color: COLORS.torch, emissive: COLORS.torch, emissiveIntensity: 2 })
    );
    brazier.position.set(0.32, 0.95, 0.15);
    g.add(brazier);
  }
  if (unit.fast) {
    const sash = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.5), mat(0xe8b23c));
    sash.position.y = 0.72;
    sash.rotation.y = Math.PI / 4;
    g.add(sash);
  }
  return g;
}

function makeEnemyUnit(unit) {
  switch (unit.key) {
    case 'hound':
      return houndFigure();
    case 'crossbow':
      return soldierFigure(0.95, { crossbow: true });
    case 'shieldbearer':
      return soldierFigure(1.05, { shield: true });
    case 'boss':
      return soldierFigure(1.55, { boss: true });
    default:
      return soldierFigure(1);
  }
}

function makeHpBar() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 12;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true })
  );
  sprite.scale.set(0.95, 0.18, 1);
  sprite.renderOrder = 40;
  sprite.userData.canvas = canvas;
  sprite.userData.texture = texture;
  return sprite;
}

export function drawHpBar(sprite, hp, maxHp) {
  const ctx = sprite.userData.canvas.getContext('2d');
  ctx.clearRect(0, 0, 64, 12);
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, 0, 64, 12);
  const frac = Math.max(hp, 0) / maxHp;
  ctx.fillStyle = frac > 0.4 ? '#6be08a' : '#e0574f';
  ctx.fillRect(2, 2, 60 * frac, 8);
  sprite.userData.texture.needsUpdate = true;
}

export function createUnitGroup(unit) {
  const g = unit.side === 'player' ? makePlayerUnit(unit) : makeEnemyUnit(unit);
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  if (unit.side === 'enemy') g.rotation.y = Math.PI; // face the obelisk

  const hpBar = makeHpBar();
  hpBar.position.y = unit.boss ? 2.9 : unit.key === 'hound' ? 1.1 : 1.85;
  drawHpBar(hpBar, unit.hp, unit.maxHp);
  g.add(hpBar);

  g.userData = { isUnit: true, uid: unit.uid, side: unit.side, hpBar };
  return g;
}

// Per-frame flourishes (spinning runes above Hand Sign units).
export function updateUnitGroup(g, dt) {
  g.traverse((o) => {
    if (o.userData && o.userData.spin) {
      o.rotation.y += dt * 2.4;
      o.rotation.x += dt * 1.1;
    }
  });
}
