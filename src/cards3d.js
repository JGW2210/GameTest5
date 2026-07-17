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
      const cost = CARDS[m.userData.key].cost;
      const ok = cost <= energy;
      m.material.color.setScalar(ok ? 1 : 0.45);
      m.userData.affordable = ok;
    }
  }

  setHover(index) {
    this.hoverIndex = index;
  }

  setDragging(index, dragging) {
    this.dragIndex = dragging ? index : -1;
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
    const spread = Math.min(0.74, 4.6 / Math.max(n, 1));
    const k = 1 - Math.exp(-dt * 11);

    this.meshes.forEach((m, i) => {
      const off = i - (n - 1) / 2;
      const hovered = i === this.hoverIndex && this.dragIndex === -1;
      const dragged = i === this.dragIndex;

      let tx, ty, tz, rx, ry, rz, ts;
      if (dragged) {
        tx = this.pointer.x;
        ty = this.pointer.y;
        tz = HAND_Z + 0.6;
        ts = 0.62;
        // sway against the direction of travel
        ry = clamp(this.pointerVel.x * 0.06, -0.5, 0.5);
        rx = clamp(-this.pointerVel.y * 0.05, -0.4, 0.4);
        rz = clamp(-this.pointerVel.x * 0.03, -0.25, 0.25);
      } else {
        tx = off * spread;
        ty = -1.52 + Math.cos(off * 0.28) * 0.16;
        tz = HAND_Z + i * 0.012;
        rx = 0;
        ry = 0;
        rz = -off * 0.085;
        ts = 1;
        if (hovered) {
          ty += 0.72;
          tz += 0.35;
          ts = 1.28;
          rz = 0;
          // tilt toward wherever the cursor sits on the card face
          const nx = clamp((this.pointer.x - tx) / ((CARD_W * ts) / 2), -1, 1);
          const nyy = clamp((this.pointer.y - ty) / ((CARD_H * ts) / 2), -1, 1);
          ry = nx * 0.34;
          rx = -nyy * 0.26;
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
