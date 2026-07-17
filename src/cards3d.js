// The hand of cards as real 3D objects, parented to the camera and fanned at
// the bottom of the view. Faces are canvas textures drawn per card type.

import * as THREE from 'three';
import { CARDS } from './data.js';

const TYPE_COLORS = {
  fist: '#c8452f',
  palm: '#3fb8a0',
  sign: '#8f65ff',
  object: '#8d8478',
};
const TYPE_LABELS = {
  fist: 'CLOSED FIST',
  palm: 'OPEN PALM',
  sign: 'HAND SIGN',
  object: 'RELIC',
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawGlyph(ctx, type, cx, cy, s, color) {
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

export function cardTexture(key) {
  if (textureCache.has(key)) return textureCache.get(key);
  const def = CARDS[key];
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 360;
  const ctx = c.getContext('2d');
  const accent = TYPE_COLORS[def.type];

  // background
  const grad = ctx.createLinearGradient(0, 0, 0, 360);
  grad.addColorStop(0, '#1c1426');
  grad.addColorStop(1, '#0d0814');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 360);
  // border
  ctx.strokeStyle = accent;
  ctx.lineWidth = 7;
  roundRect(ctx, 5, 5, 246, 350, 14);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 2;
  roundRect(ctx, 14, 14, 228, 332, 10);
  ctx.stroke();

  // cost orb
  ctx.beginPath();
  ctx.arc(34, 36, 22, 0, Math.PI * 2);
  ctx.fillStyle = '#9b6cff';
  ctx.fill();
  ctx.strokeStyle = '#d9c8ff';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 26px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(def.cost), 34, 38);

  // name
  ctx.fillStyle = '#efe6d2';
  ctx.font = 'bold 17px Georgia, serif';
  wrapText(ctx, def.name, 150, 30, 184, 19);

  // type banner
  ctx.fillStyle = accent;
  ctx.fillRect(24, 62, 208, 22);
  ctx.fillStyle = '#0d0814';
  ctx.font = 'bold 14px Georgia, serif';
  let tag = TYPE_LABELS[def.type];
  if (def.fast) tag += ' • FAST';
  if (def.range) tag += ` • RNG ${def.range}`;
  ctx.fillText(tag, 128, 74);

  // glyph
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.beginPath();
  ctx.arc(128, 158, 62, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.restore();
  drawGlyph(ctx, def.type, 128, 158, 46, accent);

  // description
  ctx.fillStyle = '#c9bfd6';
  ctx.font = '14px Georgia, serif';
  wrapText(ctx, def.desc, 128, 248, 204, 17);
  ctx.fillStyle = 'rgba(200,185,220,0.55)';
  ctx.font = 'italic 12px Georgia, serif';
  wrapText(ctx, def.flavor, 128, 296, 204, 14);

  // stats
  ctx.font = 'bold 22px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e8975c';
  ctx.fillText(`⚔ ${def.atk}`, 26, 338);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#6be08a';
  ctx.fillText(`♥ ${def.hp}`, 230, 338);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  textureCache.set(key, tex);
  return tex;
}

const CARD_W = 0.82;
const CARD_H = 1.15;
const HAND_Z = -4;

export class CardHand {
  constructor(camera) {
    this.group = new THREE.Group();
    camera.add(this.group);
    this.meshes = [];
    this.hoverIndex = -1;
    this.geo = new THREE.PlaneGeometry(CARD_W, CARD_H);
    this.backMat = new THREE.MeshBasicMaterial({ color: 0x241a33, fog: false });
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
      this.group.add(mesh);
      this.meshes.push(mesh);
    });
    this.setAffordable(energy);
    this.layout();
  }

  setAffordable(energy) {
    for (const m of this.meshes) {
      const cost = CARDS[m.userData.key].cost;
      const ok = cost <= energy;
      m.material.color.setScalar(ok ? 1 : 0.45);
      m.userData.affordable = ok;
    }
  }

  layout() {
    const n = this.meshes.length;
    const spread = Math.min(0.78, 3.4 / Math.max(n, 1));
    this.meshes.forEach((m, i) => {
      const off = i - (n - 1) / 2;
      const hovered = i === this.hoverIndex;
      m.userData.baseX = off * spread;
      m.userData.baseY = -1.52 + Math.cos(off * 0.28) * 0.16 + (hovered ? 0.72 : 0);
      m.position.set(m.userData.baseX, m.userData.baseY, HAND_Z + i * 0.012 + (hovered ? 0.35 : 0));
      m.rotation.z = hovered ? 0 : -off * 0.085;
      m.scale.setScalar(hovered ? 1.28 : 1);
    });
  }

  setHover(index) {
    if (index === this.hoverIndex) return;
    this.hoverIndex = index;
    this.layout();
  }

  setDragging(index, dragging) {
    const m = this.meshes[index];
    if (m) m.visible = !dragging;
  }

  removeCardVisual(index) {
    const m = this.meshes[index];
    if (!m) return;
    this.group.remove(m);
    m.material.dispose();
    this.meshes.splice(index, 1);
    this.meshes.forEach((mm, i) => (mm.userData.index = i));
    this.hoverIndex = -1;
    this.layout();
  }
}
