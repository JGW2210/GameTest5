// Procedural low-poly unit meshes. Every unit is a THREE.Group whose
// userData carries {uid, isUnit:true} for raycasting, plus an HP bar sprite.
//
// The cult are shadowy cloaked figures identified by what burns inside the
// hood: a single violet eye (Hand Sign — tall and skinny), twin flame eyes
// (Closed Fist — medium and stout), or nothing at all behind a great
// hand-shaped shield (Open Palm — small and wide). The crusade are clean
// steel-and-white knights.

import * as THREE from 'three';
import { COLORS } from '#game/config.js';

const mat = (color, opts = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1, flatShading: true, ...opts });

const steel = (color = 0xb9c2cc) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.55, flatShading: true });

// Soft additive halo used behind the glowing hood-eyes.
function glowSprite(colorHex, size) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const c = new THREE.Color(colorHex);
  const rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`;
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, `rgba(255,255,255,0.9)`);
  grad.addColorStop(0.25, `rgba(${rgb},0.8)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })
  );
  sprite.scale.setScalar(size);
  return sprite;
}

// A floating point of light for the hood's shadow.
function hoodEye(colorHex, r, flicker = false) {
  const g = new THREE.Group();
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(r, 8, 6),
    new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 2.4, roughness: 0.3 })
  );
  g.add(orb);
  g.add(glowSprite(colorHex, r * 6.5));
  g.userData.bobPhase = Math.random() * Math.PI * 2;
  g.userData.bobTime = 0;
  g.userData.baseY = 0;
  g.userData.isEye = true;
  if (flicker) orb.userData.flicker = { base: 2.4, t: Math.random() * 10 };
  return g;
}

// The shadowy cloak all cultists share: a hooded cone of near-darkness.
function cloak(radius, height, tint) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.ConeGeometry(radius, height, 8),
    mat(tint, { roughness: 0.95, metalness: 0 })
  );
  body.position.y = height / 2;
  body.castShadow = true;
  g.add(body);
  const hood = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.58, height * 0.34, 7), mat(tint, { roughness: 0.95 }));
  hood.position.set(0, height * 0.94, 0.02);
  hood.rotation.x = 0.14;
  g.add(hood);
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

  if (unit.type === 'sign') {
    // Tall and skinny: a single violet eye adrift in the hood.
    const g = cloak(0.27, 1.8, 0x1a1128);
    const eye = hoodEye(0xa05cff, 0.085);
    eye.position.set(0, 1.32, 0.17);
    eye.userData.baseY = 1.32;
    g.add(eye);
    return g;
  }

  if (unit.type === 'fist') {
    // Medium but stout: two small flames burn where eyes should be.
    const g = cloak(0.42, 1.15, 0x241118);
    for (const dx of [-0.1, 0.1]) {
      const eye = hoodEye(0xff8a3c, 0.055, true);
      eye.position.set(dx, 0.84, 0.3);
      eye.userData.baseY = 0.84;
      g.add(eye);
    }
    if (unit.fast) {
      const hem = new THREE.Mesh(
        new THREE.TorusGeometry(0.36, 0.035, 6, 14),
        new THREE.MeshStandardMaterial({ color: 0xe8b23c, emissive: 0xe8b23c, emissiveIntensity: 0.7 })
      );
      hem.rotation.x = Math.PI / 2;
      hem.position.y = 0.16;
      g.add(hem);
    }
    return g;
  }

  // Open Palm: small and wide, faceless, hidden behind a hand-shaped shield.
  const g = cloak(0.56, 0.8, 0x121a18);
  const shield = new THREE.Group();
  const slate = mat(0x4d5a55, { roughness: 0.6, metalness: 0.3 });
  const palmSlab = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.55, 0.07), slate);
  shield.add(palmSlab);
  // five fingers along the top edge
  const fingerHeights = [0.2, 0.3, 0.34, 0.3, 0.22];
  fingerHeights.forEach((h, i) => {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.085, h, 0.06), slate);
    f.position.set(-0.2 + i * 0.1, 0.275 + h / 2 - 0.02, 0);
    shield.add(f);
  });
  const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.24, 0.06), slate);
  thumb.position.set(-0.31, 0.1, 0);
  thumb.rotation.z = 0.7;
  shield.add(thumb);
  // teal sigil at the shield's heart
  const sigil = new THREE.Mesh(
    new THREE.CircleGeometry(0.11, 12),
    new THREE.MeshStandardMaterial({
      color: COLORS.palm,
      emissive: COLORS.palm,
      emissiveIntensity: 1.4,
      side: THREE.DoubleSide,
    })
  );
  sigil.position.z = 0.04;
  shield.add(sigil);
  shield.position.set(0, 0.52, 0.42);
  g.add(shield);
  return g;
}

// ---- the crusade: tightened steel-and-white knights ------------------------

function knight(scale = 1, { shield = false, crossbow = false, boss = false } = {}) {
  const g = new THREE.Group();
  const plate = boss ? steel(0xd9d2b8) : steel();

  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.44, 0.26), mat(0x4a4438, { roughness: 0.7 }));
  legs.position.y = 0.22;
  g.add(legs);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.6, 0.3), plate);
  torso.position.y = 0.8;
  torso.castShadow = true;
  g.add(torso);

  // white tabard with the church's red cross
  const tabard = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.52, 0.03), mat(0xe8e4da, { roughness: 0.85 }));
  tabard.position.set(0, 0.76, 0.17);
  g.add(tabard);
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.36, 0.015), mat(0xa8302a));
  crossV.position.set(0, 0.78, 0.19);
  g.add(crossV);
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, 0.015), mat(0xa8302a));
  crossH.position.set(0, 0.86, 0.19);
  g.add(crossH);

  // pauldrons
  for (const dx of [-0.31, 0.31]) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5, 0, Math.PI * 2, 0, Math.PI / 2), plate);
    p.position.set(dx, 1.06, 0);
    g.add(p);
  }

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), mat(0xd8c6a8));
  head.position.y = 1.28;
  g.add(head);
  const helm = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.19, 0.22, 6), boss ? steel(0xd4af37) : plate);
  helm.position.y = 1.4;
  g.add(helm);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.05), mat(0x1a1a20));
  visor.position.set(0, 1.36, 0.16);
  g.add(visor);

  if (shield) {
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.3, 0.07, 8), steel(0x8a97a8));
    sh.rotation.x = Math.PI / 2;
    sh.position.set(0, 0.74, 0.36);
    g.add(sh);
    const boss2 = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), steel(0xd4af37));
    boss2.position.set(0, 0.74, 0.42);
    g.add(boss2);
  }
  if (crossbow) {
    const bow = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.05, 0.07), mat(0x6a4a2a));
    bow.position.set(0, 0.98, 0.3);
    g.add(bow);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.3), mat(0x4a331e));
    stock.position.set(0, 0.98, 0.4);
    g.add(stock);
  }
  if (boss) {
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.04, 6, 18),
      new THREE.MeshStandardMaterial({ color: 0xffd970, emissive: 0xd4a017, emissiveIntensity: 1.6, roughness: 0.4 })
    );
    halo.position.y = 1.72;
    halo.rotation.x = Math.PI / 12;
    g.add(halo);
    const cape = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.95, 0.05), mat(0xece7db));
    cape.position.set(0, 0.72, -0.22);
    g.add(cape);
  }
  g.scale.setScalar(scale);
  return g;
}

function houndFigure() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.72), mat(0x7a6a55));
  body.position.y = 0.42;
  body.castShadow = true;
  g.add(body);
  // white church barding over the back
  const barding = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.5), mat(0xe8e4da));
  barding.position.y = 0.58;
  g.add(barding);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.3), mat(0x8a785e));
  head.position.set(0, 0.55, 0.48);
  g.add(head);
  for (const [x, z] of [[-0.1, 0.24], [0.1, 0.24], [-0.1, -0.24], [0.1, -0.24]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 0.08), mat(0x655741));
    leg.position.set(x, 0.16, z);
    g.add(leg);
  }
  return g;
}

// The Grand Inquisitor: not a knight but the church made flesh — a towering
// robed figure crowned in a blazing spiked halo, one searing eye in the hood.
function inquisitorFigure() {
  const g = new THREE.Group();
  const ivory = mat(0xefe8d4, { roughness: 0.75 });
  const gold = new THREE.MeshStandardMaterial({
    color: 0xd4a017,
    roughness: 0.35,
    metalness: 0.7,
    flatShading: true,
    emissive: 0x8a6510,
    emissiveIntensity: 0.35,
  });

  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.95, 3.1, 9), ivory);
  robe.position.y = 1.55;
  robe.castShadow = true;
  g.add(robe);
  const trim = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.07, 6, 18), gold);
  trim.rotation.x = Math.PI / 2;
  trim.position.y = 0.35;
  g.add(trim);

  // red cross on the breast of the robe
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.7, 0.04), mat(0xa8302a));
  crossV.position.set(0, 2.1, 0.47);
  crossV.rotation.x = -0.28;
  g.add(crossV);
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.13, 0.04), mat(0xa8302a));
  crossH.position.set(0, 2.26, 0.42);
  crossH.rotation.x = -0.28;
  g.add(crossH);

  // pauldrons wide as a doorway
  for (const dx of [-0.72, 0.72]) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.3, 7, 5, 0, Math.PI * 2, 0, Math.PI / 2), gold);
    p.position.set(dx, 2.62, 0);
    g.add(p);
  }

  // a hood of shadow with a single searing eye
  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.85, 7), mat(0x241d16, { roughness: 0.95 }));
  hood.position.y = 3.2;
  g.add(hood);
  const eye = hoodEye(0xffd970, 0.11, true);
  eye.position.set(0, 3.05, 0.24);
  eye.userData.baseY = 3.05;
  g.add(eye);

  // the spiked halo — a wheel of judgement behind the hood
  const halo = new THREE.Group();
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 6, 22), gold);
  halo.add(wheel);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.42, 4), gold);
    spike.position.set(Math.cos(a) * 0.82, Math.sin(a) * 0.82, 0);
    spike.rotation.z = a - Math.PI / 2;
    halo.add(spike);
  }
  halo.position.set(0, 3.35, -0.28);
  halo.userData.spin = true;
  g.add(halo);

  // golden censer-light at his feet
  const light = new THREE.PointLight(0xffd970, 18, 7, 2);
  light.position.y = 2.4;
  g.add(light);
  return g;
}

function makeEnemyUnit(unit) {
  switch (unit.key) {
    case 'hound':
      return houndFigure();
    case 'crossbow':
      return knight(0.95, { crossbow: true });
    case 'shieldbearer':
      return knight(1.05, { shield: true });
    case 'boss':
      return knight(1.55, { boss: true });
    case 'inquisitor':
      return inquisitorFigure();
    default:
      return knight(1);
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

const HP_BAR_Y = { sign: 2.15, fist: 1.5, palm: 1.3, object: 1.3 };

export function createUnitGroup(unit) {
  const g = unit.side === 'player' ? makePlayerUnit(unit) : makeEnemyUnit(unit);
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  // Combat facing: crusaders look toward the obelisk, the cult toward the
  // gate. Kept in userData so animations (telekinetic spins, the sermon's
  // about-face) can always land a unit back on its true facing.
  const baseFacing = unit.side === 'enemy' ? Math.PI : 0;
  g.rotation.y = baseFacing;

  const hpBar = makeHpBar();
  hpBar.position.y =
    unit.side === 'player'
      ? HP_BAR_Y[unit.type] || 1.5
      : unit.key === 'inquisitor'
        ? 4.1
        : unit.boss
          ? 2.9
          : unit.key === 'hound'
            ? 1.1
            : 1.8;
  drawHpBar(hpBar, unit.hp, unit.maxHp);
  g.add(hpBar);

  g.userData = { isUnit: true, uid: unit.uid, side: unit.side, hpBar, baseFacing };
  return g;
}

// ---- enemy intent telegraphs ----------------------------------------------

const INTENT_STYLE = {
  advance: { color: '#e8e4da' },
  strike: { color: '#ff6a5a' },
  volley: { color: '#ffb46b' },
  siege: { color: '#c9a6ff' },
  ability: { color: '#ffd970' },
  wait: { color: '#8a93a0' },
  dazed: { color: '#8a93a0' },
};

const intentTextureCache = new Map();

function intentTexture(kind) {
  if (intentTextureCache.has(kind)) return intentTextureCache.get(kind);
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const color = (INTENT_STYLE[kind] || INTENT_STYLE.advance).color;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  if (kind === 'advance') {
    for (const dy of [0, 18]) {
      ctx.beginPath();
      ctx.moveTo(14, 34 + dy);
      ctx.lineTo(32, 16 + dy);
      ctx.lineTo(50, 34 + dy);
      ctx.stroke();
    }
  } else if (kind === 'strike') {
    ctx.beginPath();
    ctx.moveTo(16, 16);
    ctx.lineTo(48, 48);
    ctx.moveTo(48, 16);
    ctx.lineTo(16, 48);
    ctx.stroke();
  } else if (kind === 'volley') {
    ctx.beginPath();
    ctx.moveTo(14, 50);
    ctx.lineTo(46, 18);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(46, 18);
    ctx.lineTo(30, 20);
    ctx.moveTo(46, 18);
    ctx.lineTo(44, 34);
    ctx.stroke();
  } else if (kind === 'siege') {
    ctx.beginPath();
    ctx.moveTo(32, 10);
    ctx.lineTo(48, 32);
    ctx.lineTo(32, 54);
    ctx.lineTo(16, 32);
    ctx.closePath();
    ctx.stroke();
  } else if (kind === 'ability') {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const r = i % 2 === 0 ? 24 : 9;
      ctx[i === 0 ? 'moveTo' : 'lineTo'](32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  } else {
    // wait / dazed: two bars
    ctx.beginPath();
    ctx.moveTo(24, 18);
    ctx.lineTo(24, 46);
    ctx.moveTo(40, 18);
    ctx.lineTo(40, 46);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  intentTextureCache.set(kind, tex);
  return tex;
}

// Attach or update the floating intent symbol above an enemy.
export function setIntent(group, kind) {
  if (group.userData.intentSprite) {
    group.remove(group.userData.intentSprite);
    group.userData.intentSprite.material.dispose();
    group.userData.intentSprite = null;
  }
  if (!kind) return;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: intentTexture(kind), transparent: true, depthTest: false, opacity: 0.95 })
  );
  sprite.scale.setScalar(0.42);
  sprite.position.y = group.userData.hpBar.position.y + 0.34;
  sprite.renderOrder = 45;
  group.add(sprite);
  group.userData.intentSprite = sprite;
}

// Per-frame flourishes: hood-eyes bob gently, flame-eyes flicker.
export function updateUnitGroup(g, dt) {
  g.traverse((o) => {
    if (o.userData && o.userData.isEye) {
      o.userData.bobTime += dt;
      o.position.y = o.userData.baseY + Math.sin(o.userData.bobTime * 2.1 + o.userData.bobPhase) * 0.05;
    }
    if (o.userData && o.userData.flicker) {
      const f = o.userData.flicker;
      f.t += dt;
      o.material.emissiveIntensity = f.base + Math.sin(f.t * 11) * 0.5 + Math.sin(f.t * 23.7) * 0.35;
    }
    if (o.userData && o.userData.spin) {
      o.rotation.z += dt * 0.6;
    }
  });
}
