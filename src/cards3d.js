// The hand of cards as real 3D objects, parented to the camera and fanned at
// the bottom of the view. Faces are canvas textures drawn per card type.

import * as THREE from 'three';
import { CARDS, ENEMIES } from '#game/data.js';

const TYPE_COLORS = {
  fist: '#c8452f',
  palm: '#3fb8a0',
  sign: '#8f65ff',
  object: '#8d8478',
  tk: '#59f0c8',
};
const TYPE_LABELS = {
  fist: 'CLOSED FIST',
  palm: 'OPEN PALM',
  sign: 'HAND SIGN',
  object: 'RELIC',
  tk: 'KINAETIC RITE',
};
const RUNIC = '"Uncial Antiqua", Georgia, serif';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawGlyph(ctx, type, cx, cy, s, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.14;
  ctx.lineCap = 'round';
  if (type === 'palm') {
    ctx.beginPath();
    ctx.arc(0, 0.35, 0.55, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.38;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 0.35, 0.25 + Math.sin(a) * 0.35);
      ctx.lineTo(Math.cos(a) * 1.05, 0.25 + Math.sin(a) * 1.05);
      ctx.lineWidth = 0.24;
      ctx.stroke();
    }
  } else if (type === 'fist') {
    roundRect(ctx, -0.6, -0.45, 1.2, 1.05, 0.25);
    ctx.fill();
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(-0.45 + i * 0.3, -0.45, 0.16, 0, Math.PI * 2);
      ctx.fill();
    }
    roundRect(ctx, -0.85, -0.15, 0.3, 0.6, 0.14);
    ctx.fill();
  } else if (type === 'sign') {
    ctx.beginPath();
    ctx.arc(0, 0.5, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 0.26;
    ctx.beginPath();
    ctx.moveTo(-0.18, 0.3);
    ctx.lineTo(-0.42, -0.75);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0.18, 0.3);
    ctx.lineTo(0.42, -0.75);
    ctx.stroke();
    // spark between the fingers
    ctx.beginPath();
    ctx.arc(0, -0.55, 0.14, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'crush') {
    // clenched fist with converging force lines
    roundRect(ctx, -0.45, -0.32, 0.9, 0.8, 0.2);
    ctx.fill();
    ctx.lineWidth = 0.12;
    for (const a of [-2.6, -2.0, -1.1, -0.5, 0.6, 1.2, 2.1, 2.7]) {
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 1.05, Math.sin(a) * 1.05);
      ctx.lineTo(Math.cos(a) * 0.7, Math.sin(a) * 0.7);
      ctx.stroke();
    }
  } else if (type === 'trip') {
    // a toppling figure over a sweeping arc
    ctx.save();
    ctx.rotate(0.6);
    ctx.beginPath();
    ctx.arc(0, -0.35, 0.22, 0, Math.PI * 2);
    ctx.fill();
    roundRect(ctx, -0.13, -0.1, 0.26, 0.7, 0.1);
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = 0.16;
    ctx.beginPath();
    ctx.arc(0, 0.45, 0.75, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  } else if (type === 'crusader') {
    // the church's cross, ringed
    ctx.lineWidth = 0.13;
    ctx.beginPath();
    ctx.arc(0, 0, 0.85, 0, Math.PI * 2);
    ctx.stroke();
    roundRect(ctx, -0.14, -0.62, 0.28, 1.24, 0.08);
    ctx.fill();
    roundRect(ctx, -0.46, -0.3, 0.92, 0.28, 0.08);
    ctx.fill();
  } else if (type === 'beckon') {
    // the eye, open
    ctx.lineWidth = 0.14;
    ctx.beginPath();
    ctx.moveTo(-0.95, 0);
    ctx.quadraticCurveTo(0, -0.85, 0.95, 0);
    ctx.quadraticCurveTo(0, 0.85, -0.95, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 0.34, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // relic / object — a faceted stone
    ctx.beginPath();
    ctx.moveTo(0, -0.7);
    ctx.lineTo(0.65, -0.15);
    ctx.lineTo(0.45, 0.6);
    ctx.lineTo(-0.4, 0.65);
    ctx.lineTo(-0.65, -0.1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = w;
      y += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, y);
  return y;
}

const textureCache = new Map();

export function clearCardTextures() {
  for (const tex of textureCache.values()) tex.dispose();
  textureCache.clear();
}

// The card table faces are drawn from. The hub swaps in the smith-upgraded
// table before a battle; textures are re-rendered from scratch.
let ACTIVE_CARDS = CARDS;

export function setCardSource(cards) {
  ACTIVE_CARDS = cards || CARDS;
  clearCardTextures();
}

export function cardTexture(key) {
  if (textureCache.has(key)) return textureCache.get(key);
  const def = ACTIVE_CARDS[key] || CARDS[key];
  const isTk = def.type === 'tk';
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 360;
  const ctx = c.getContext('2d');
  const accent = TYPE_COLORS[def.type];

  // deep shadow slab, soft-edged — no hard border
  const grad = ctx.createRadialGradient(128, 150, 40, 128, 190, 280);
  grad.addColorStop(0, isTk ? '#0e2420' : '#191126');
  grad.addColorStop(0.75, '#0b0712');
  grad.addColorStop(1, 'rgba(8,5,12,0.0)');
  roundRect(ctx, 4, 4, 248, 352, 22);
  ctx.fillStyle = grad;
  ctx.fill();

  // faint aetherial edge glow
  ctx.save();
  ctx.shadowColor = accent;
  ctx.shadowBlur = 16;
  ctx.strokeStyle = `${accent}55`;
  ctx.lineWidth = 2;
  roundRect(ctx, 8, 8, 240, 344, 20);
  ctx.stroke();
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // cost: flames for troops, the eye for rites
  ctx.save();
  ctx.shadowBlur = 12;
  if (isTk) {
    ctx.shadowColor = '#59f0c8';
    drawGlyph(ctx, 'beckon', 34, 34, 15, '#59f0c8');
  } else {
    ctx.shadowColor = '#ff8a3c';
    ctx.fillStyle = '#ffb46b';
    ctx.font = `bold 30px ${RUNIC}`;
    ctx.fillText(String(def.cost), 34, 36);
    ctx.beginPath(); // small flame tick under the number
    ctx.moveTo(34, 62);
    ctx.quadraticCurveTo(41, 52, 34, 44);
    ctx.quadraticCurveTo(27, 52, 34, 62);
    ctx.fillStyle = '#ff8a3c';
    ctx.fill();
  }
  ctx.restore();

  // name in runic script, glowing
  ctx.save();
  ctx.shadowColor = accent;
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#f2ead6';
  ctx.font = `19px ${RUNIC}`;
  wrapText(ctx, def.name, 148, 30, 178, 22);
  ctx.restore();

  // type line — plain glowing text, no banner
  ctx.fillStyle = accent;
  ctx.font = `13px ${RUNIC}`;
  let tag = TYPE_LABELS[def.type];
  if (def.fast) tag += ' • FAST';
  if (def.range) tag += ` • RNG ${def.range}`;
  ctx.save();
  ctx.shadowColor = accent;
  ctx.shadowBlur = 8;
  ctx.fillText(tag, 128, 78);
  ctx.restore();

  // glyph with halo
  ctx.save();
  ctx.globalAlpha = 0.13;
  ctx.beginPath();
  ctx.arc(128, 158, 60, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.shadowColor = accent;
  ctx.shadowBlur = 18;
  drawGlyph(ctx, isTk ? def.power : def.type, 128, 158, 44, accent);
  ctx.restore();

  // description + flavor
  ctx.fillStyle = '#cfc4e0';
  ctx.font = '14px Georgia, serif';
  wrapText(ctx, def.desc, 128, 244, 208, 17);
  ctx.fillStyle = 'rgba(200,185,220,0.5)';
  ctx.font = 'italic 12px Georgia, serif';
  wrapText(ctx, def.flavor, 128, 300, 208, 14);

  // stats as floating glow text
  if (!isTk) {
    ctx.font = `bold 21px ${RUNIC}`;
    ctx.save();
    ctx.shadowBlur = 10;
    ctx.textAlign = 'left';
    ctx.shadowColor = '#e8975c';
    ctx.fillStyle = '#e8975c';
    ctx.fillText(`⚔ ${def.atk}`, 26, 336);
    ctx.textAlign = 'right';
    ctx.shadowColor = '#6be08a';
    ctx.fillStyle = '#6be08a';
    ctx.fillText(`♥ ${def.hp}`, 230, 336);
    // the smith's mark: a golden star per forging
    if (def.forged) {
      ctx.textAlign = 'center';
      ctx.shadowColor = '#ffd970';
      ctx.fillStyle = '#ffd970';
      ctx.font = `bold 16px ${RUNIC}`;
      ctx.fillText('★'.repeat(Math.min(def.forged, 3)), 128, 336);
    }
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  textureCache.set(key, tex);
  return tex;
}

// ---- enemy card faces (for unit inspection) --------------------------------

const enemyTextureCache = new Map();

export function enemyCardTexture(key) {
  if (enemyTextureCache.has(key)) return enemyTextureCache.get(key);
  const def = ENEMIES[key];
  const accent = def.boss ? '#ffd970' : '#d8a83c';
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 360;
  const ctx = c.getContext('2d');

  const grad = ctx.createRadialGradient(128, 150, 40, 128, 190, 280);
  grad.addColorStop(0, '#241c10');
  grad.addColorStop(0.75, '#100b06');
  grad.addColorStop(1, 'rgba(10,7,4,0.0)');
  roundRect(ctx, 4, 4, 248, 352, 22);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.save();
  ctx.shadowColor = accent;
  ctx.shadowBlur = 16;
  ctx.strokeStyle = `${accent}55`;
  ctx.lineWidth = 2;
  roundRect(ctx, 8, 8, 240, 344, 20);
  ctx.stroke();
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.save();
  ctx.shadowColor = accent;
  ctx.shadowBlur = 12;
  drawGlyph(ctx, 'crusader', 34, 34, 16, accent);
  ctx.restore();

  ctx.save();
  ctx.shadowColor = accent;
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#f2ead6';
  ctx.font = `19px ${RUNIC}`;
  wrapText(ctx, def.name, 148, 30, 178, 22);
  ctx.restore();

  let tag = def.boss ? 'THE CRUSADE • COMMANDER' : 'THE CRUSADE';
  if (def.kind === 'ranged') tag += ` • RNG ${def.range}`;
  if (def.armor) tag += ` • ARMOR ${def.armor}`;
  ctx.save();
  ctx.fillStyle = accent;
  ctx.font = `13px ${RUNIC}`;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 8;
  ctx.fillText(tag, 128, 78);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.13;
  ctx.beginPath();
  ctx.arc(128, 158, 60, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.shadowColor = accent;
  ctx.shadowBlur = 18;
  drawGlyph(ctx, 'crusader', 128, 158, 44, accent);
  ctx.restore();

  ctx.fillStyle = '#e0d4c0';
  ctx.font = '14px Georgia, serif';
  wrapText(ctx, def.desc, 128, 244, 208, 17);
  if (def.flavor) {
    ctx.fillStyle = 'rgba(220,200,175,0.5)';
    ctx.font = 'italic 12px Georgia, serif';
    wrapText(ctx, def.flavor, 128, 300, 208, 14);
  }

  ctx.font = `bold 21px ${RUNIC}`;
  ctx.save();
  ctx.shadowBlur = 10;
  ctx.textAlign = 'left';
  ctx.shadowColor = '#e8975c';
  ctx.fillStyle = '#e8975c';
  ctx.fillText(`⚔ ${def.atk}`, 26, 336);
  ctx.textAlign = 'right';
  ctx.shadowColor = '#6be08a';
  ctx.fillStyle = '#6be08a';
  ctx.fillText(`♥ ${def.hp}`, 230, 336);
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  enemyTextureCache.set(key, tex);
  return tex;
}

// PNG data URL of a card face — used by the hub's card grid and the in-battle
// unit inspector, which live in the DOM rather than the 3D scene.
export function cardFaceDataURL(key, isEnemy = false) {
  const tex = isEnemy ? enemyCardTexture(key) : cardTexture(key);
  return tex.image.toDataURL();
}

const CARD_W = 0.66;
const CARD_H = 0.93;
const HAND_Z = -4;

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

// The hand lives in camera space; every card springs smoothly toward a target
// pose recomputed each frame. Hovered cards lift and tilt toward the cursor;
// a dragged card follows the cursor with a velocity sway.
export class CardHand {
  constructor(camera) {
    this.camera = camera;
    this.group = new THREE.Group();
    camera.add(this.group);
    this.meshes = [];
    this.hoverIndex = -1;
    this.dragIndex = -1;
    this.dockIndex = -1; // card parked at the USE zone while a target is chosen
    this.geo = new THREE.PlaneGeometry(CARD_W, CARD_H);
    this.pointer = { x: 0, y: -1.6 }; // camera-space coords on the hand plane
    this.pointerVel = { x: 0, y: 0 };
  }

  // Convert pointer NDC to camera-space coordinates at the hand plane depth.
  setPointerNDC(nx, ny) {
    const halfH = Math.tan((this.camera.fov * Math.PI) / 360) * Math.abs(HAND_Z);
    const halfW = halfH * this.camera.aspect;
    this.pointerTarget = { x: nx * halfW, y: ny * halfH };
  }

  setHand(keys, energy) {
    for (const m of this.meshes) {
      this.group.remove(m);
      m.material.dispose();
    }
    this.meshes = [];
    keys.forEach((key, i) => {
      const mat = new THREE.MeshBasicMaterial({ map: cardTexture(key), fog: false, transparent: true });
      const mesh = new THREE.Mesh(this.geo, mat);
      mesh.renderOrder = 30 + i;
      mesh.userData = { isCard: true, index: i, key };
      // Deal-in: new cards rise from below the frame.
      mesh.position.set(0, -3.2, HAND_Z + i * 0.012);
      this.group.add(mesh);
      this.meshes.push(mesh);
    });
    this.hoverIndex = -1;
    this.dragIndex = -1;
    this.setAffordable(energy);
  }

  setAffordable(energy) {
    for (const m of this.meshes) {
      const cost = (ACTIVE_CARDS[m.userData.key] || CARDS[m.userData.key]).cost;
      const ok = cost <= energy;
      m.material.color.setScalar(ok ? 1 : 0.45);
      m.userData.affordable = ok;
    }
  }

  setHover(index) {
    this.hoverIndex = index;
  }

  // Stable hover picking: inside the hand band the card is chosen by fan slot,
  // so the lifted card doesn't slide out from under the cursor and flicker.
  slotIndexAt() {
    const n = this.meshes.length;
    if (!n) return -1;
    const p = this.pointerTarget || this.pointer;
    if (p.y > -0.7) return -1; // above the hand band
    const spread = Math.min(0.6, 4.2 / n);
    const idx = Math.round(p.x / spread + (n - 1) / 2);
    if (idx < 0 || idx >= n) return -1;
    const off = idx - (n - 1) / 2;
    if (Math.abs(p.x - off * spread) > Math.max(spread * 0.6, 0.34)) return -1;
    return idx;
  }

  setDragging(index, dragging) {
    this.dragIndex = dragging ? index : -1;
  }

  // Park a card at the USE zone (right edge) while the player picks its target.
  setDocked(index) {
    this.dockIndex = index;
    if (index >= 0) this.dragIndex = -1;
  }

  removeCardVisual(index) {
    const m = this.meshes[index];
    if (!m) return;
    this.group.remove(m);
    m.material.dispose();
    this.meshes.splice(index, 1);
    this.meshes.forEach((mm, i) => (mm.userData.index = i));
    this.hoverIndex = -1;
    this.dragIndex = -1;
    this.dockIndex = -1;
  }

  update(dt) {
    // Smooth the pointer itself, tracking velocity for drag sway.
    if (this.pointerTarget) {
      const px = this.pointer.x;
      const py = this.pointer.y;
      const pk = 1 - Math.exp(-dt * 22);
      this.pointer.x += (this.pointerTarget.x - this.pointer.x) * pk;
      this.pointer.y += (this.pointerTarget.y - this.pointer.y) * pk;
      if (dt > 0) {
        this.pointerVel.x = (this.pointer.x - px) / dt;
        this.pointerVel.y = (this.pointer.y - py) / dt;
      }
    }

    const n = this.meshes.length;
    const spread = Math.min(0.6, 4.2 / Math.max(n, 1));
    const k = 1 - Math.exp(-dt * 11);
    const halfH = Math.tan((this.camera.fov * Math.PI) / 360) * Math.abs(HAND_Z);
    const halfW = halfH * this.camera.aspect;

    this.meshes.forEach((m, i) => {
      const off = i - (n - 1) / 2;
      const hovered = i === this.hoverIndex && this.dragIndex === -1 && this.dockIndex === -1;
      const dragged = i === this.dragIndex;
      const docked = i === this.dockIndex;

      let tx, ty, tz, rx, ry, rz, ts;
      if (docked) {
        // parked at the USE zone while the player chooses a target
        tx = halfW * 0.74;
        ty = -halfH * 0.1;
        tz = HAND_Z + 0.55;
        ts = 1.1;
        rx = 0;
        ry = -0.18;
        rz = 0;
      } else if (dragged) {
        tx = this.pointer.x;
        ty = this.pointer.y;
        tz = HAND_Z + 0.6;
        // Picked up at the hand the card enlarges for reading; carried up
        // toward the board it shrinks out of the way.
        const lift = clamp((this.pointer.y + halfH * 0.94) / (halfH * 0.85), 0, 1);
        ts = 1.5 - lift * 0.88;
        // sway against the direction of travel
        ry = clamp(this.pointerVel.x * 0.06, -0.5, 0.5);
        rx = clamp(-this.pointerVel.y * 0.05, -0.4, 0.4);
        rz = clamp(-this.pointerVel.x * 0.03, -0.25, 0.25);
      } else {
        tx = off * spread;
        ty = -1.42 + Math.cos(off * 0.28) * 0.13;
        tz = HAND_Z + i * 0.012;
        rx = 0;
        ry = 0;
        rz = -off * 0.085;
        ts = 1;
        if (hovered) {
          // a filing-cabinet riffle: the card eases up a little, no zoom —
          // click (press) to lift and read it
          ty += 0.22;
          tz += 0.2;
          ts = 1.06;
          rz = -off * 0.03;
          const nx = clamp((this.pointer.x - tx) / (CARD_W / 2), -1, 1);
          ry = nx * 0.12;
        }
      }

      m.position.x += (tx - m.position.x) * k;
      m.position.y += (ty - m.position.y) * k;
      m.position.z += (tz - m.position.z) * k;
      m.rotation.x += (rx - m.rotation.x) * k;
      m.rotation.y += (ry - m.rotation.y) * k;
      m.rotation.z += (rz - m.rotation.z) * k;
      const s = m.scale.x + (ts - m.scale.x) * k;
      m.scale.setScalar(s);
    });
  }
}
