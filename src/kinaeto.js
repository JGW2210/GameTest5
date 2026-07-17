// Kinaeto — a benevolent Lovecraftian god manifesting as a great hand with an
// eye set in its palm, reaching through the portal above the obelisk room.

import * as THREE from 'three';
import { COLORS, PORTAL_POS } from './config.js';
import { Ease } from './effects.js';

const skinMat = () =>
  new THREE.MeshStandardMaterial({
    color: 0x241833,
    roughness: 0.55,
    metalness: 0.15,
    flatShading: true,
    emissive: 0x120a20,
    emissiveIntensity: 0.6,
  });

function finger(length, thickness) {
  const g = new THREE.Group();
  const lower = new THREE.Mesh(new THREE.BoxGeometry(thickness, length * 0.55, thickness), skinMat());
  lower.position.y = length * 0.275;
  g.add(lower);
  const upperPivot = new THREE.Group();
  upperPivot.position.y = length * 0.55;
  const upper = new THREE.Mesh(
    new THREE.BoxGeometry(thickness * 0.85, length * 0.45, thickness * 0.85),
    skinMat()
  );
  upper.position.y = length * 0.225;
  upperPivot.add(upper);
  upperPivot.rotation.x = -0.55; // curled toward the viewer
  g.add(upperPivot);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(thickness * 0.5, thickness * 1.1, 5), skinMat());
  tip.position.y = length * 0.45 + thickness * 0.5;
  upperPivot.add(tip);
  return g;
}

export class Kinaeto {
  constructor(scene, tweens) {
    this.scene = scene;
    this.tweens = tweens;
    this.time = 0;
    this.visible = false;

    this.group = new THREE.Group();

    // Palm facing the player, fingers up.
    const palm = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.5, 0.7), skinMat());
    this.group.add(palm);

    const fingerSpecs = [
      { x: -0.78, len: 1.5 },
      { x: -0.27, len: 1.9 },
      { x: 0.27, len: 1.8 },
      { x: 0.78, len: 1.4 },
    ];
    for (const s of fingerSpecs) {
      const f = finger(s.len, 0.42);
      f.position.set(s.x, 1.2, 0);
      f.rotation.x = -0.12;
      this.group.add(f);
    }
    const thumb = finger(1.2, 0.44);
    thumb.position.set(-1.1, -0.3, 0.1);
    thumb.rotation.z = 0.9;
    thumb.rotation.x = -0.3;
    this.group.add(thumb);

    // The eye set in the palm.
    this.eye = new THREE.Group();
    const white = new THREE.Mesh(
      new THREE.SphereGeometry(0.62, 14, 10),
      new THREE.MeshStandardMaterial({
        color: 0xf2ead8,
        roughness: 0.25,
        emissive: 0x8a7f5e,
        emissiveIntensity: 0.25,
      })
    );
    white.scale.z = 0.55;
    this.eye.add(white);
    const iris = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 12, 8),
      new THREE.MeshStandardMaterial({
        color: COLORS.eldritch,
        emissive: COLORS.eldritch,
        emissiveIntensity: 1.8,
        roughness: 0.2,
      })
    );
    iris.position.z = 0.24;
    iris.scale.z = 0.5;
    this.eye.add(iris);
    this.iris = iris;
    const pupil = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0x050208 })
    );
    pupil.position.z = 0.4;
    pupil.scale.z = 0.4;
    this.eye.add(pupil);
    this.pupil = pupil;
    this.eye.position.z = 0.32;
    this.group.add(this.eye);

    this.eyeLight = new THREE.PointLight(COLORS.eldritch, 0, 16, 2);
    this.eyeLight.position.z = 1.4;
    this.group.add(this.eyeLight);

    // Hidden inside the portal until called.
    this.homePos = new THREE.Vector3(PORTAL_POS.x, PORTAL_POS.y, PORTAL_POS.z);
    this.outPos = new THREE.Vector3(PORTAL_POS.x, PORTAL_POS.y - 0.6, PORTAL_POS.z + 3.4);
    this.group.position.copy(this.homePos);
    this.group.scale.setScalar(0.01);
    this.group.rotation.x = 0.16;
    scene.add(this.group);
  }

  async emerge() {
    if (this.visible) return;
    this.visible = true;
    await this.tweens.run({
      duration: 0.9,
      ease: Ease.outBack,
      onUpdate: (e) => {
        this.group.position.lerpVectors(this.homePos, this.outPos, e);
        this.group.scale.setScalar(Math.max(0.01, e));
        this.eyeLight.intensity = e * 30;
      },
    });
  }

  async retreat() {
    if (!this.visible) return;
    this.visible = false;
    await this.tweens.run({
      duration: 0.7,
      ease: Ease.inOutCubic,
      onUpdate: (e) => {
        this.group.position.lerpVectors(this.outPos, this.homePos, e);
        this.group.scale.setScalar(Math.max(0.01, 1 - e));
        this.eyeLight.intensity = (1 - e) * 30;
      },
    });
  }

  blink() {
    this.tweens.run({
      duration: 0.28,
      ease: Ease.inOutCubic,
      onUpdate: (e) => {
        const k = 1 - Math.sin(e * Math.PI) * 0.92;
        this.eye.scale.y = k;
      },
    });
  }

  update(dt) {
    this.time += dt;
    if (this.visible) {
      const t = this.time;
      this.group.position.y = this.outPos.y + Math.sin(t * 1.3) * 0.22;
      this.group.rotation.z = Math.sin(t * 0.9) * 0.05;
      // The eye wanders, watching the battlefield.
      this.pupil.position.x = Math.sin(t * 0.7) * 0.12;
      this.pupil.position.y = Math.sin(t * 1.1 + 1) * 0.08;
      this.iris.position.x = this.pupil.position.x * 0.6;
      this.iris.position.y = this.pupil.position.y * 0.6;
      if (Math.random() < dt * 0.25) this.blink();
    }
  }
}
