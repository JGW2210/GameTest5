// Renderer, camera, and the torch-lit cave environment: rock shell, obelisk
// platform, torches, ember particles, and the portal ring Kinaeto uses.

import * as THREE from 'three';
import { CAMERA, CAMERA_POSES, COLORS, OBELISK_POS, PORTAL_POS, PATH_X, rowZ, ROWS, WALLS } from './config.js';
import { drawGlyph } from './cards3d.js';

function jitterGeometry(geo, amount) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(
      i,
      pos.getX(i) + (Math.random() - 0.5) * amount,
      pos.getY(i) + (Math.random() - 0.5) * amount,
      pos.getZ(i) + (Math.random() - 0.5) * amount
    );
  }
  geo.computeVertexNormals();
  return geo;
}

const rockMat = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0.02, flatShading: true });

export class World {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.fog);
    this.scene.fog = new THREE.FogExp2(COLORS.fog, 0.016);

    this.camera = new THREE.PerspectiveCamera(CAMERA.fov, window.innerWidth / window.innerHeight, 0.1, 120);
    this.camera.position.set(CAMERA.pos.x, CAMERA.pos.y, CAMERA.pos.z);
    this.camera.lookAt(CAMERA.look.x, CAMERA.look.y, CAMERA.look.z);
    this.scene.add(this.camera); // so camera-space children (the card hand) render

    this.time = 0;
    this.shake = 0;
    // Cursor-driven vertical glance: -1 = bottom (path mouths), +1 = top
    // (full obelisk). Focus overrides the glance for Kinaeto close-ups.
    this.glance = 0;
    this.glanceTarget = 0;
    this.focus = 0;
    this.focusTarget = 0;
    // Fixed side views: -1 = stand at the left wall (right wall in view),
    // +1 = stand at the right wall. Toggled by arrow keys / swipes.
    this.side = 0;
    this.sideTarget = 0;
    this.rigEnabled = true;
    this._pose = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
    this.torchFlames = [];
    this.torchLights = [];

    this.buildLights();
    this.buildCave();
    this.buildWalls();
    this.buildObelisk();
    this.buildPortal();
    this.buildEmbers();

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  buildLights() {
    this.scene.add(new THREE.AmbientLight(0x6a5580, 0.85));
    const hemi = new THREE.HemisphereLight(0x7a5a76, 0x241512, 0.7);
    this.scene.add(hemi);

    // Key light so the board reads clearly.
    const key = new THREE.DirectionalLight(0xffd9b0, 0.75);
    key.position.set(6, 18, 10);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -14;
    key.shadow.camera.right = 14;
    key.shadow.camera.top = 16;
    key.shadow.camera.bottom = -18;
    key.shadow.camera.far = 50;
    key.shadow.bias = -0.0004;
    this.scene.add(key);

    // Violet glow from the obelisk.
    this.obeliskLight = new THREE.PointLight(COLORS.kinaetic, 60, 26, 2);
    this.obeliskLight.position.set(OBELISK_POS.x, 5, OBELISK_POS.z + 1);
    this.scene.add(this.obeliskLight);
  }

  buildCave() {
    // Floor
    const floorGeo = jitterGeometry(new THREE.CircleGeometry(46, 40), 0.35);
    const floor = new THREE.Mesh(floorGeo, rockMat(COLORS.floor));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.12;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Cave shell
    const shellGeo = jitterGeometry(new THREE.CylinderGeometry(34, 40, 34, 22, 4, true), 1.6);
    const shell = new THREE.Mesh(
      shellGeo,
      new THREE.MeshStandardMaterial({
        color: COLORS.rock,
        roughness: 1,
        flatShading: true,
        side: THREE.BackSide,
      })
    );
    shell.position.y = 10;
    this.scene.add(shell);

    // Stalactites
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const rad = 14 + Math.random() * 18;
      const h = 2 + Math.random() * 5;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.5 + Math.random() * 0.8, h, 5), rockMat(COLORS.rockDark));
      cone.position.set(Math.cos(a) * rad, 22 - h / 2 + Math.random() * 3, Math.sin(a) * rad - 4);
      cone.rotation.x = Math.PI;
      this.scene.add(cone);
    }

    // Boulders framing the paths (kept in front of the carved walls)
    for (let i = 0; i < 18; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.8 + Math.random() * 1.6, 0),
        rockMat(COLORS.rockDark)
      );
      rock.position.set(side * (9.2 + Math.random() * 2.4), 0.4, -12 + Math.random() * 24);
      rock.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      rock.castShadow = true;
      this.scene.add(rock);
    }

    // Torches along both outer edges of the battlefield.
    const torchZs = [rowZ(1), rowZ(3), rowZ(5)];
    for (const z of torchZs) {
      for (const x of [-8.3, 8.3]) {
        this.addTorch(x, z, true);
      }
    }
    // Torches between the paths (no dynamic light, emissive only)
    for (const z of [rowZ(2), rowZ(4)]) {
      for (const x of [(PATH_X[0] + PATH_X[1]) / 2, (PATH_X[1] + PATH_X[2]) / 2]) {
        this.addTorch(x, z, false);
      }
    }
  }

  addTorch(x, z, withLight) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 1.9, 6), rockMat(0x4a3423));
    pole.position.y = 0.95;
    g.add(pole);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.1, 0.16, 6), rockMat(0x333));
    bowl.position.y = 1.92;
    g.add(bowl);
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.5, 6),
      new THREE.MeshStandardMaterial({
        color: 0xffc46b,
        emissive: COLORS.torch,
        emissiveIntensity: 2.6,
        roughness: 0.4,
      })
    );
    flame.position.y = 2.3;
    g.add(flame);
    this.torchFlames.push(flame);
    if (withLight) {
      const light = new THREE.PointLight(COLORS.torch, 26, 13, 2);
      light.position.y = 2.4;
      g.add(light);
      this.torchLights.push(light);
    }
    g.position.set(x, 0, z);
    this.scene.add(g);
  }

  // Carved cult slogans on the cave walls, lit up when a side view faces them.
  carvingTexture(text, glyphs) {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 384;
    const ctx = c.getContext('2d');

    // stone base with speckle
    ctx.fillStyle = '#2c2025';
    ctx.fillRect(0, 0, 1024, 384);
    for (let i = 0; i < 700; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,235,255,0.05)';
      ctx.fillRect(Math.random() * 1024, Math.random() * 384, 2 + Math.random() * 5, 2 + Math.random() * 4);
    }

    // chiselled text (highlight above, dark groove below)
    const lines = text.length > 18 ? [text.slice(0, text.lastIndexOf(' ', 18)), text.slice(text.lastIndexOf(' ', 18) + 1)] : [text];
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '10px';
    const size = lines.length > 1 ? 86 : 96;
    ctx.font = `bold ${size}px Georgia, serif`;
    lines.forEach((line, i) => {
      const y = 148 + i * (size + 14) - (lines.length - 1) * 40;
      ctx.fillStyle = 'rgba(215,190,235,0.28)';
      ctx.fillText(line, 512, y - 3);
      ctx.fillStyle = '#140d16';
      ctx.fillText(line, 512, y);
    });

    // hand carvings flanking the text
    const gy = lines.length > 1 ? 320 : 280;
    glyphs.forEach((type, i) => {
      const gx = 512 + (i === 0 ? -330 : 330);
      drawGlyph(ctx, type, gx + 2, gy - 2, 52, 'rgba(215,190,235,0.25)');
      drawGlyph(ctx, type, gx, gy, 52, '#140d16');
    });

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  buildWalls() {
    this.walls = {};
    for (const side of ['left', 'right']) {
      const sign = side === 'left' ? -1 : 1;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(1.4, 8.4, 19.5), rockMat(0x342529));
      slab.position.set(sign * WALLS.x, WALLS.y, WALLS.z);
      slab.rotation.y = sign * 0.06;
      this.scene.add(slab);

      const tex = this.carvingTexture(WALLS[side].text, WALLS[side].glyphs);
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.9,
        emissive: COLORS.rune,
        emissiveMap: tex,
        emissiveIntensity: 0.08,
      });
      const face = new THREE.Mesh(new THREE.PlaneGeometry(16.8, 6.3), mat);
      face.position.set(sign * (WALLS.x - 0.78), WALLS.y, WALLS.z);
      face.rotation.y = sign * (-Math.PI / 2 + 0.06);
      this.scene.add(face);

      const light = new THREE.SpotLight(0xd9c2ff, 0, 45, Math.PI / 4.5, 0.5, 1.4);
      light.position.set(sign * 5.5, 10.5, WALLS.z);
      light.target.position.set(sign * WALLS.x, WALLS.y, WALLS.z);
      this.scene.add(light);
      this.scene.add(light.target);

      this.walls[side] = { mat, light, face };
    }
  }

  buildObelisk() {
    // Raised platform for the obelisk room.
    const plat = new THREE.Mesh(new THREE.BoxGeometry(20, 1.1, 8.4), rockMat(0x322636));
    plat.position.set(0, 0.28, -11.6);
    plat.receiveShadow = true;
    this.scene.add(plat);

    const steps = new THREE.Mesh(new THREE.BoxGeometry(20, 0.55, 1.6), rockMat(0x2b2130));
    steps.position.set(0, 0.14, -6.9);
    this.scene.add(steps);

    this.obelisk = new THREE.Group();
    const spire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 1.25, 7, 4),
      new THREE.MeshStandardMaterial({
        color: COLORS.obelisk,
        roughness: 0.35,
        metalness: 0.4,
        flatShading: true,
        emissive: COLORS.rune,
        emissiveIntensity: 0.25,
      })
    );
    spire.position.y = 4.3;
    spire.rotation.y = Math.PI / 4;
    spire.castShadow = true;
    this.obelisk.add(spire);
    this.spire = spire;

    const tip = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.55),
      new THREE.MeshStandardMaterial({ color: COLORS.rune, emissive: COLORS.rune, emissiveIntensity: 2.2 })
    );
    tip.position.y = 8.3;
    tip.userData.tip = true;
    this.obelisk.add(tip);
    this.obeliskTip = tip;

    // Orbiting rune rings
    this.runeRings = [];
    for (let i = 0; i < 2; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.5 + i * 0.6, 0.05, 6, 24),
        new THREE.MeshStandardMaterial({
          color: COLORS.rune,
          emissive: COLORS.rune,
          emissiveIntensity: 1.5,
          transparent: true,
          opacity: 0.8,
        })
      );
      ring.position.y = 3.4 + i * 1.6;
      ring.rotation.x = Math.PI / 2 + 0.25 * (i ? -1 : 1);
      this.obelisk.add(ring);
      this.runeRings.push(ring);
    }

    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.1, 0.8, 6), rockMat(0x241a2e));
    base.position.y = 0.4;
    this.obelisk.add(base);

    this.obelisk.position.set(OBELISK_POS.x, 0.85, OBELISK_POS.z);
    this.scene.add(this.obelisk);
  }

  buildPortal() {
    this.portal = new THREE.Group();
    const outer = new THREE.Mesh(
      new THREE.TorusGeometry(3.1, 0.22, 8, 40),
      new THREE.MeshStandardMaterial({ color: 0x2a1a3a, emissive: COLORS.eldritch, emissiveIntensity: 1.1, roughness: 0.4 })
    );
    this.portal.add(outer);
    const inner = new THREE.Mesh(
      new THREE.TorusGeometry(2.55, 0.1, 6, 36),
      new THREE.MeshStandardMaterial({ color: 0x1a1030, emissive: COLORS.kinaeticGlow, emissiveIntensity: 1.6 })
    );
    this.portal.add(inner);
    this.portalRings = [outer, inner];
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(2.6, 36),
      new THREE.MeshBasicMaterial({ color: 0x0b0618, transparent: true, opacity: 0.92, side: THREE.DoubleSide })
    );
    this.portal.add(disc);
    const swirl = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 2.4, 24, 1, 0, Math.PI * 1.4),
      new THREE.MeshBasicMaterial({ color: COLORS.eldritch, transparent: true, opacity: 0.18, side: THREE.DoubleSide })
    );
    swirl.position.z = 0.02;
    this.portal.add(swirl);
    this.portalSwirl = swirl;

    this.portal.position.set(PORTAL_POS.x, PORTAL_POS.y, PORTAL_POS.z);
    this.portal.rotation.x = -0.12;
    this.scene.add(this.portal);
  }

  buildEmbers() {
    const count = 130;
    const positions = new Float32Array(count * 3);
    this.emberData = [];
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 34;
      const y = Math.random() * 9;
      const z = -18 + Math.random() * 32;
      positions.set([x, y, z], i * 3);
      this.emberData.push({ speed: 0.25 + Math.random() * 0.6, drift: Math.random() * Math.PI * 2 });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.embers = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: COLORS.ember, size: 0.09, transparent: true, opacity: 0.8 })
    );
    this.scene.add(this.embers);
  }

  addShake(amount) {
    this.shake = Math.min(this.shake + amount, 0.6);
  }

  update(dt) {
    this.time += dt;
    const t = this.time;

    for (let i = 0; i < this.torchFlames.length; i++) {
      const f = this.torchFlames[i];
      const n = Math.sin(t * 9 + i * 1.7) * 0.5 + Math.sin(t * 15.7 + i * 3.1) * 0.5;
      f.scale.set(1 + n * 0.12, 1 + n * 0.22, 1 + n * 0.12);
      f.material.emissiveIntensity = 2.4 + n * 0.7;
    }
    for (let i = 0; i < this.torchLights.length; i++) {
      this.torchLights[i].intensity = 24 + Math.sin(t * 11 + i * 2.3) * 5;
    }

    this.obeliskLight.intensity = 55 + Math.sin(t * 2.2) * 12;
    this.obeliskTip.rotation.y += dt * 1.2;
    this.spire.material.emissiveIntensity = 0.22 + Math.sin(t * 2.2) * 0.1;
    for (let i = 0; i < this.runeRings.length; i++) {
      this.runeRings[i].rotation.z += dt * (i ? -0.5 : 0.7);
    }

    this.portalRings[0].rotation.z += dt * 0.4;
    this.portalRings[1].rotation.z -= dt * 0.7;
    this.portalSwirl.rotation.z -= dt * 1.6;

    const pos = this.embers.geometry.attributes.position;
    for (let i = 0; i < this.emberData.length; i++) {
      const d = this.emberData[i];
      let y = pos.getY(i) + d.speed * dt;
      if (y > 10) y = 0;
      pos.setY(i, y);
      pos.setX(i, pos.getX(i) + Math.sin(t * 0.8 + d.drift) * dt * 0.15);
    }
    pos.needsUpdate = true;

    // Camera rig: glance blend + side view blend + Kinaeto focus + breathing.
    if (this.rigEnabled) {
      this.glance += (this.glanceTarget - this.glance) * Math.min(dt * 3.2, 1);
      this.side += (this.sideTarget - this.side) * Math.min(dt * 2.6, 1);
      this.focus += (this.focusTarget - this.focus) * Math.min(dt * 2.4, 1);
    }
    const P = CAMERA_POSES;
    const glancePose = this.glance < 0 ? P.bottom : P.top;
    const g = Math.abs(this.glance);
    const pose = this._pose;
    pose.pos.fromArray(P.default.pos);
    pose.look.fromArray(P.default.look);
    pose.pos.lerp(new THREE.Vector3().fromArray(glancePose.pos), g);
    pose.look.lerp(new THREE.Vector3().fromArray(glancePose.look), g);
    const sidePose = this.side < 0 ? P.sideLeft : P.sideRight;
    const sd = Math.abs(this.side);
    const sdSmooth = sd * sd * (3 - 2 * sd);
    pose.pos.lerp(new THREE.Vector3().fromArray(sidePose.pos), sdSmooth);
    pose.look.lerp(new THREE.Vector3().fromArray(sidePose.look), sdSmooth);
    const f = this.focus * this.focus * (3 - 2 * this.focus); // smoothstep
    pose.pos.lerp(new THREE.Vector3().fromArray(P.kinaeto.pos), f);
    pose.look.lerp(new THREE.Vector3().fromArray(P.kinaeto.look), f);

    // The wall being faced lights up; its carvings glow.
    const litRight = Math.max(0, -this.side);
    const litLeft = Math.max(0, this.side);
    this.walls.right.light.intensity = litRight * 60;
    this.walls.left.light.intensity = litLeft * 60;
    this.walls.right.mat.emissiveIntensity = 0.08 + litRight * 1.05;
    this.walls.left.mat.emissiveIntensity = 0.08 + litLeft * 1.05;

    this.shake = Math.max(this.shake - dt * 1.8, 0);
    const s = this.shake;
    this.camera.position.set(
      pose.pos.x + Math.sin(t * 0.4) * 0.12 + (Math.random() - 0.5) * s,
      pose.pos.y + Math.sin(t * 0.55) * 0.08 + (Math.random() - 0.5) * s,
      pose.pos.z + (Math.random() - 0.5) * s * 0.5
    );
    this.camera.lookAt(pose.look.x, pose.look.y + Math.sin(t * 0.5) * 0.05, pose.look.z);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
