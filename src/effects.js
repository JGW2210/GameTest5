// Small frame-based tween manager plus floating combat text sprites.

import * as THREE from 'three';

export const Ease = {
  linear: (t) => t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
};

export class Tweens {
  constructor() {
    this.list = [];
  }

  // Returns a promise that resolves when the tween completes.
  run({ duration = 0.4, delay = 0, ease = Ease.outCubic, onUpdate, onComplete }) {
    return new Promise((resolve) => {
      this.list.push({
        t: -delay,
        duration,
        ease,
        onUpdate,
        done: () => {
          if (onComplete) onComplete();
          resolve();
        },
      });
    });
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const tw = this.list[i];
      tw.t += dt;
      if (tw.t < 0) continue;
      const k = Math.min(tw.t / tw.duration, 1);
      if (tw.onUpdate) tw.onUpdate(tw.ease(k), k);
      if (k >= 1) {
        this.list.splice(i, 1);
        tw.done();
      }
    }
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function makeTextSprite(text, { size = 44, color = '#ffffff', stroke = '#000000' } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.font = `bold ${size}px 'Georgia', serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 8;
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, 128, 48);
  ctx.fillStyle = color;
  ctx.fillText(text, 128, 48);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.2, 0.82, 1);
  return sprite;
}

export function floatText(scene, tweens, pos, text, color = '#ffffff') {
  const sprite = makeTextSprite(text, { color });
  sprite.position.copy(pos);
  sprite.renderOrder = 50;
  scene.add(sprite);
  tweens.run({
    duration: 0.9,
    ease: Ease.outCubic,
    onUpdate: (e) => {
      sprite.position.y = pos.y + e * 1.6;
      sprite.material.opacity = 1 - e * e;
    },
    onComplete: () => {
      scene.remove(sprite);
      sprite.material.map.dispose();
      sprite.material.dispose();
    },
  });
}
