// Renderer, camera rig, and the swappable stage environments:
//  'cave'    — the torch-lit lower gate (battle one)
//  'sanctum' — the established ceremony grounds (tutorial): stone floors,
//              hanging lanterns, and a grand altar around a larger obelisk
//  'hub'     — the cult's cave between battles: card altar, cold forge, and
//              the broken obelisk Kinaeto whispers through
// Common pieces (lights, camera rig, portal, embers) are shared builders;
// setStage() tears down and rebuilds the environment group.

import * as THREE from 'three';
import { CAMERA, CAMERA_POSES, COLORS, OBELISK_POS, PORTAL_POS, PATH_X, rowZ, ROWS, WALLS } from '#game/config.js';
import { drawGlyph } from '#game/cards3d.js';

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
    this.basePose = 'default'; // which CAMERA_POSES entry the rig rests on
    this._pose = { pos: new THREE.Vector3(), look: new THREE.Vector3() };

    this.stageName = null;
    this.stageGroup = null;

    this.buildLights();

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  // ---- stage lifecycle ------------------------------------------------------

  setStage(name) {
    if (this.stageName === name) return;
    if (this.stageGroup) {
      this.scene.remove(this.stageGroup);
      this.stageGroup.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
            if (m.map) m.map.dispose();
            m.dispose();
          }
        }
      });
    }
    this.stageGroup = new THREE.Group();
    this.scene.add(this.stageGroup);

    // per-stage references, reset for the guards in update()
    this.torchFlames = [];
    this.torchLights = [];
    this.lanterns = [];
    this.floatCards = [];
    this.stations = [];
    this.walls = null;
    this.obelisk = null;
    this.obeliskLight = null;
    this.obeliskTip = null;
    this.spire = null;
    this.runeRings = [];
    this.portal = null;
    this.portalRings = null;
    this.portalSwirl = null;
    this.embers = null;
    this.emberData = [];
    this.fireLight = null;
    this.fireFlame = null;
    this.forgeLight = null;
    this.obeliskBroken = false;

    if (name === 'sanctum') this.buildSanctumStage();
    else if (name === 'hub') this.buildHubStage();
    else this.buildCaveStage();

    this.stageName = name;
    this.basePose = name === 'hub' ? 'hub' : 'default';
    this.glance = this.glanceTarget = 0;
    this.side = this.sideTarget = 0;
    this.focus = this.focusTarget = 0;
  }

  add(obj) {
    this.stageGroup.add(obj);
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
  }

  // ---- stage: the lower gate cave (battle one) ------------------------------

  buildCaveStage() {
    this.buildCaveShell();

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
      this.add(rock);
    }

    // Torches along both outer edges of the battlefield.
    for (const z of [rowZ(1), rowZ(3), rowZ(5)]) {
      for (const x of [-8.3, 8.3]) this.addTorch(x, z, true);
    }
    // Torches between the paths (no dynamic light, emissive only)
    for (const z of [rowZ(2), rowZ(4)]) {
      for (const x of [(PATH_X[0] + PATH_X[1]) / 2, (PATH_X[1] + PATH_X[2]) / 2]) {
        this.addTorch(x, z, false);
      }
    }

    this.buildWalls();
    this.buildObeliskPlatform(0x322636, 0x2b2130);
    // The rebuilt obelisk: short, plain, one lonely halo — square one.
    this.buildObelisk(0.72, 1);
    this.buildPortal(1);
    this.buildEmbers();
  }

  // ---- stage: the sanctum (tutorial ceremony grounds) -----------------------

  buildSanctumStage() {
    this.buildCaveShell();

    // Cut stone flags underfoot instead of raw rock: an uneven grid of slabs
    // in varying greys, each settled at its own slight tilt.
    for (let gx = -5; gx <= 5; gx++) {
      for (let gz = -7; gz <= 4; gz++) {
        if (Math.random() < 0.06) continue; // a missing flag here and there
        const w = 1.9 + Math.random() * 0.5;
        const d = 1.9 + Math.random() * 0.5;
        const shade = 0.85 + Math.random() * 0.3;
        const col = new THREE.Color(COLORS.stone).multiplyScalar(shade);
        const flag = new THREE.Mesh(new THREE.BoxGeometry(w, 0.14, d), rockMat(col.getHex()));
        flag.position.set(gx * 2.25 + (Math.random() - 0.5) * 0.2, -0.02 + Math.random() * 0.05, gz * 2.3 + (Math.random() - 0.5) * 0.2);
        flag.rotation.y = (Math.random() - 0.5) * 0.05;
        flag.receiveShadow = true;
        this.add(flag);
      }
    }

    // Hanging lanterns on long chains from the dark above, swaying gently.
    const lanternSpots = [
      [-7, 9.5, -8], [7, 9.5, -8],
      [-8, 10, -1], [8, 10, -1],
      [-7.5, 9.8, 6], [7.5, 9.8, 6],
      [-3, 11, -12], [3, 11, -12],
    ];
    lanternSpots.forEach(([x, y, z], i) => this.addLantern(x, y, z, i % 2 === 0));

    this.buildWalls();

    // The grand altar: a hexagonal dais, a carved rune ring, and a crown of
    // pillars with braziers — a cult with real influence built this.
    const daisLow = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 6.1, 0.55, 8), rockMat(0x3a3244));
    daisLow.position.set(OBELISK_POS.x, 0.27, OBELISK_POS.z + 0.6);
    daisLow.receiveShadow = true;
    this.add(daisLow);
    const daisHigh = new THREE.Mesh(new THREE.CylinderGeometry(4.1, 4.6, 0.6, 8), rockMat(0x453b52));
    daisHigh.position.set(OBELISK_POS.x, 0.82, OBELISK_POS.z + 0.6);
    daisHigh.receiveShadow = true;
    this.add(daisHigh);
    const steps = new THREE.Mesh(new THREE.BoxGeometry(7, 0.35, 1.8), rockMat(0x3a3244));
    steps.position.set(0, 0.17, -7.2);
    this.add(steps);

    const runeRing = new THREE.Mesh(
      new THREE.TorusGeometry(4.9, 0.09, 6, 40),
      new THREE.MeshStandardMaterial({ color: COLORS.rune, emissive: COLORS.rune, emissiveIntensity: 0.9, roughness: 0.5 })
    );
    runeRing.rotation.x = Math.PI / 2;
    runeRing.position.set(OBELISK_POS.x, 0.6, OBELISK_POS.z + 0.6);
    this.add(runeRing);

    for (let i = 0; i < 6; i++) {
      const a = Math.PI * 2 * (i / 6) + Math.PI / 6;
      const px = OBELISK_POS.x + Math.cos(a) * 6.4;
      const pz = OBELISK_POS.z + 0.6 + Math.sin(a) * 5.2;
      if (pz > -7.6) continue; // keep the approach to the altar open
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 3.4, 6), rockMat(0x4a3f58));
      pillar.position.set(px, 1.7, pz);
      pillar.castShadow = true;
      this.add(pillar);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.28, 1.15), rockMat(0x3a3244));
      cap.position.set(px, 3.55, pz);
      this.add(cap);
      this.addBrazier(px, 3.7, pz, i % 2 === 0);
    }

    this.buildObelisk(1.4, 3);
    this.buildPortal(1.15);
    this.buildEmbers();
  }

  // ---- stage: the hub cave --------------------------------------------------

  buildHubStage() {
    this.buildCaveShell();

    // campfire at the heart of the refuge
    const fire = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28, 0), rockMat(COLORS.rockDark));
      st.position.set(Math.cos(a) * 0.75, 0.14, Math.sin(a) * 0.75);
      fire.add(st);
    }
    this.fireFlame = new THREE.Mesh(
      new THREE.ConeGeometry(0.4, 1.1, 6),
      new THREE.MeshStandardMaterial({ color: 0xffc46b, emissive: COLORS.torch, emissiveIntensity: 2.4, roughness: 0.4 })
    );
    this.fireFlame.position.y = 0.6;
    fire.add(this.fireFlame);
    this.fireLight = new THREE.PointLight(COLORS.torch, 40, 18, 2);
    this.fireLight.position.y = 1.6;
    fire.add(this.fireLight);
    fire.position.set(0, 0, 3.5);
    this.add(fire);

    // ---- the broken obelisk & Kinaeto's faint portal (centre back) ----------
    const link = new THREE.Group();
    const stump = new THREE.Mesh(
      jitterGeometry(new THREE.CylinderGeometry(0.9, 1.25, 1.6, 5), 0.16),
      new THREE.MeshStandardMaterial({
        color: COLORS.obelisk, roughness: 0.5, metalness: 0.3, flatShading: true,
        emissive: COLORS.rune, emissiveIntensity: 0.1,
      })
    );
    stump.position.y = 0.8;
    link.add(stump);
    for (let i = 0; i < 7; i++) {
      const shard = new THREE.Mesh(
        new THREE.TetrahedronGeometry(0.22 + Math.random() * 0.3),
        rockMat(0x241a2e)
      );
      shard.position.set((Math.random() - 0.5) * 4.5, 0.15, (Math.random() - 0.5) * 3);
      shard.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      link.add(shard);
    }
    // scaffold: the new obelisk begun — leaning timber poles around the stump
    for (const [dx, dz, tilt] of [[-1.4, 0.6, 0.3], [1.3, 0.8, -0.28], [0.9, -1, -0.2], [-1, -0.9, 0.24]]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 4.4, 5), rockMat(0x4a3423));
      pole.position.set(dx, 2, dz);
      pole.rotation.z = tilt * Math.sign(dx) * -1;
      pole.rotation.x = tilt * Math.sign(dz) * 0.5;
      link.add(pole);
    }
    this.obeliskLight = new THREE.PointLight(COLORS.kinaetic, 25, 20, 2);
    this.obeliskLight.position.y = 3;
    link.add(this.obeliskLight);
    link.position.set(OBELISK_POS.x, 0, OBELISK_POS.z + 2);
    link.userData.station = 'portal';
    this.add(link);
    this.stations.push({ group: link, kind: 'portal', label: 'THE SEVERED LINK — speak with Kinaeto' });

    this.buildPortal(0.8);
    // the portal is only a crack now: dim it
    this.portalRings[0].material.emissiveIntensity = 0.35;
    this.portalRings[1].material.emissiveIntensity = 0.5;
    this.portalSwirl.material.opacity = 0.08;

    // ---- the card altar (left): choose who marches --------------------------
    const altar = new THREE.Group();
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.45, 1.5, 6), rockMat(0x3a3244));
    plinth.position.y = 0.75;
    plinth.castShadow = true;
    altar.add(plinth);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.22, 1.6), rockMat(0x453b52));
    slab.position.y = 1.6;
    altar.add(slab);
    for (let i = 0; i < 3; i++) {
      const card = new THREE.Mesh(
        new THREE.PlaneGeometry(0.62, 0.9),
        new THREE.MeshStandardMaterial({
          color: 0x1a1128,
          emissive: COLORS.eldritch,
          emissiveIntensity: 0.5,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.92,
        })
      );
      card.position.set((i - 1) * 0.55, 2.5, (i - 1) * 0.1);
      card.userData.floatPhase = i * 2.1;
      altar.add(card);
      this.floatCards.push(card);
    }
    const altarLight = new THREE.PointLight(COLORS.eldritch, 16, 10, 2);
    altarLight.position.y = 2.6;
    altar.add(altarLight);
    altar.position.set(-6.8, 0, -2.5);
    altar.rotation.y = 0.5;
    altar.userData.station = 'deck';
    this.add(altar);
    this.stations.push({ group: altar, kind: 'deck', label: 'THE ALTAR OF NAMES — choose who marches' });

    // ---- the smith's forge (right): bolster the faithful --------------------
    const forge = new THREE.Group();
    const hearth = new THREE.Mesh(
      jitterGeometry(new THREE.CylinderGeometry(1.5, 1.9, 1.3, 7), 0.12),
      rockMat(0x3c3230)
    );
    hearth.position.y = 0.65;
    forge.add(hearth);
    const coals = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 1, 0.25, 7),
      new THREE.MeshStandardMaterial({ color: 0xff8a3c, emissive: 0xff6a2a, emissiveIntensity: 1.6, roughness: 0.6 })
    );
    coals.position.y = 1.35;
    forge.add(coals);
    this.forgeLight = new THREE.PointLight(0xff8a3c, 22, 11, 2);
    this.forgeLight.position.y = 2;
    forge.add(this.forgeLight);
    // anvil on a stump beside the hearth
    const stump2 = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.8, 7), rockMat(0x4a3423));
    stump2.position.set(-1.9, 0.4, 0.7);
    forge.add(stump2);
    const anvil = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.32, 0.42), rockMat(0x565d66));
    anvil.position.set(-1.9, 0.95, 0.7);
    anvil.castShadow = true;
    forge.add(anvil);
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.55, 5), rockMat(0x565d66));
    horn.rotation.z = Math.PI / 2;
    horn.position.set(-2.55, 0.95, 0.7);
    forge.add(horn);
    forge.position.set(6.8, 0, -2.5);
    forge.rotation.y = -0.5;
    forge.userData.station = 'smith';
    this.add(forge);
    this.stations.push({ group: forge, kind: 'smith', label: 'THE COLD FORGE — bolster the faithful' });

    // a few torches so the refuge feels tended
    this.addTorch(-3.4, -7.5, true);
    this.addTorch(3.4, -7.5, true);
    this.addTorch(-9, 3, false);
    this.addTorch(9, 3, false);

    this.buildEmbers();
  }

  // ---- shared builders ------------------------------------------------------

  buildCaveShell() {
    const floorGeo = jitterGeometry(new THREE.CircleGeometry(46, 40), 0.35);
    const floor = new THREE.Mesh(floorGeo, rockMat(COLORS.floor));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.12;
    floor.receiveShadow = true;
    this.add(floor);

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
    this.add(shell);

    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const rad = 14 + Math.random() * 18;
      const h = 2 + Math.random() * 5;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.5 + Math.random() * 0.8, h, 5), rockMat(COLORS.rockDark));
      cone.position.set(Math.cos(a) * rad, 22 - h / 2 + Math.random() * 3, Math.sin(a) * rad - 4);
      cone.rotation.x = Math.PI;
      this.add(cone);
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
    this.add(g);
  }

  // A lantern swinging on a chain from the dark above.
  addLantern(x, topY, z, withLight) {
    const pivot = new THREE.Group();
    pivot.position.set(x, topY, z);
    const chainLen = 2.6 + Math.random() * 1.2;
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, chainLen, 4), rockMat(0x2a2420));
    chain.position.y = -chainLen / 2;
    pivot.add(chain);
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.3, 0.5, 6),
      rockMat(0x3c3020)
    );
    body.position.y = -chainLen - 0.25;
    pivot.add(body);
    const glow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.24, 0.34, 6),
      new THREE.MeshStandardMaterial({
        color: COLORS.lantern,
        emissive: COLORS.lantern,
        emissiveIntensity: 2.2,
        roughness: 0.4,
      })
    );
    glow.position.y = -chainLen - 0.25;
    pivot.add(glow);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.24, 6), rockMat(0x2a2420));
    cap.position.y = -chainLen + 0.06;
    pivot.add(cap);
    if (withLight) {
      const light = new THREE.PointLight(COLORS.lantern, 16, 12, 2);
      light.position.y = -chainLen - 0.3;
      pivot.add(light);
    }
    this.lanterns.push({ pivot, phase: Math.random() * Math.PI * 2, glow });
    this.add(pivot);
  }

  addBrazier(x, y, z, withLight) {
    const g = new THREE.Group();
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.2, 0.26, 6), rockMat(0x333));
    g.add(bowl);
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.24, 0.7, 6),
      new THREE.MeshStandardMaterial({
        color: 0xffc46b,
        emissive: COLORS.torch,
        emissiveIntensity: 2.6,
        roughness: 0.4,
      })
    );
    flame.position.y = 0.45;
    g.add(flame);
    this.torchFlames.push(flame);
    if (withLight) {
      const light = new THREE.PointLight(COLORS.torch, 22, 11, 2);
      light.position.y = 0.7;
      g.add(light);
      this.torchLights.push(light);
    }
    g.position.set(x, y, z);
    this.add(g);
  }

  // Carved cult slogans on the cave walls, lit up when a side view faces
  // them. Drawn to read as rough rock-chisel work: every letter is struck
  // at its own slight angle, edges chipped, cracks running off the strokes.
  carvingTexture(text, glyphs) {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 384;
    const ctx = c.getContext('2d');

    // stone base: uneven patches and grit, no polish
    ctx.fillStyle = '#2c2025';
    ctx.fillRect(0, 0, 1024, 384);
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '10,5,10' : '90,70,85'},${0.04 + Math.random() * 0.05})`;
      ctx.beginPath();
      ctx.ellipse(Math.random() * 1024, Math.random() * 384, 40 + Math.random() * 120, 20 + Math.random() * 60, Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.15)' : 'rgba(255,235,255,0.05)';
      ctx.fillRect(Math.random() * 1024, Math.random() * 384, 1 + Math.random() * 4, 1 + Math.random() * 3);
    }

    const chisel = (draw, x, y, jitter) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((Math.random() - 0.5) * jitter);
      // chipped highlight on the sun side of the groove, then the dark cut,
      // struck twice slightly apart so edges look broken, not printed
      draw('rgba(200,175,215,0.20)', -2.5, -3);
      draw('rgba(0,0,0,0.55)', 1.5, 2.5);
      draw('#150e18', 0, 0);
      ctx.restore();
    };

    const lines = text.length > 18 ? [text.slice(0, text.lastIndexOf(' ', 18)), text.slice(text.lastIndexOf(' ', 18) + 1)] : [text];
    const size = lines.length > 1 ? 88 : 104;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${size}px "Uncial Antiqua", Georgia, serif`;

    // strike each letter separately with its own slight rotation and drift
    lines.forEach((line, li) => {
      const y = 138 + li * (size + 18) - (lines.length - 1) * 34;
      const widths = [...line].map((ch) => ctx.measureText(ch).width);
      const total = widths.reduce((a, b) => a + b, 0) + (line.length - 1) * 6;
      let x = 512 - total / 2;
      [...line].forEach((ch, i) => {
        const cx = x + widths[i] / 2;
        const cy = y + (Math.random() - 0.5) * 10;
        chisel((color, dx, dy) => {
          ctx.fillStyle = color;
          ctx.fillText(ch, dx, dy);
        }, cx, cy, 0.09);
        x += widths[i] + 6;
      });
    });

    // hand carvings flanking the text, struck the same way
    const gy = lines.length > 1 ? 316 : 286;
    glyphs.forEach((type, i) => {
      const gx = 512 + (i === 0 ? -350 : 350);
      chisel((color, dx, dy) => drawGlyph(ctx, type, dx, dy, 54, color), gx, gy, 0.16);
    });

    // cracks wandering off the carvings
    ctx.strokeStyle = 'rgba(10,5,12,0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      let cx = Math.random() * 1024;
      let cy = Math.random() * 384;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      for (let s = 0; s < 5 + Math.random() * 5; s++) {
        cx += (Math.random() - 0.5) * 90;
        cy += (Math.random() - 0.3) * 55;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  // Re-render the carvings (used once the runic webfont finishes loading).
  refreshWallCarvings() {
    if (!this.walls) return;
    for (const side of ['left', 'right']) {
      const old = this.walls[side].mat;
      const tex = this.carvingTexture(WALLS[side].text, WALLS[side].glyphs);
      old.map.dispose();
      old.map = tex;
      old.emissiveMap = tex;
      old.needsUpdate = true;
    }
  }

  buildWalls() {
    this.walls = {};
    for (const side of ['left', 'right']) {
      const sign = side === 'left' ? -1 : 1;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(1.4, 8.4, 19.5), rockMat(0x342529));
      slab.position.set(sign * WALLS.x, WALLS.y, WALLS.z);
      slab.rotation.y = sign * 0.06;
      this.add(slab);

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
      this.add(face);

      const light = new THREE.SpotLight(0xd9c2ff, 0, 45, Math.PI / 4.5, 0.5, 1.4);
      light.position.set(sign * 5.5, 10.5, WALLS.z);
      light.target.position.set(sign * WALLS.x, WALLS.y, WALLS.z);
      this.add(light);
      this.add(light.target);

      this.walls[side] = { mat, light, face };
    }
  }

  buildObeliskPlatform(platColor, stepColor) {
    const plat = new THREE.Mesh(new THREE.BoxGeometry(20, 1.1, 8.4), rockMat(platColor));
    plat.position.set(0, 0.28, -11.6);
    plat.receiveShadow = true;
    this.add(plat);
    const steps = new THREE.Mesh(new THREE.BoxGeometry(20, 0.55, 1.6), rockMat(stepColor));
    steps.position.set(0, 0.14, -6.9);
    this.add(steps);
  }

  // scale sizes the whole spire; rings is how many orbit it — the sanctum's
  // grand obelisk earns three, the rebuilt one barely keeps one.
  buildObelisk(scale = 1, ringCount = 2) {
    this.obeliskLight = new THREE.PointLight(COLORS.kinaetic, 60 * scale, 26 * scale, 2);
    this.obeliskLight.position.set(OBELISK_POS.x, 5 * scale, OBELISK_POS.z + 1);
    this.add(this.obeliskLight);

    this.obelisk = new THREE.Group();
    const spire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55 * scale, 1.25 * scale, 7 * scale, 4),
      new THREE.MeshStandardMaterial({
        color: COLORS.obelisk,
        roughness: 0.35,
        metalness: 0.4,
        flatShading: true,
        emissive: COLORS.rune,
        emissiveIntensity: 0.25,
      })
    );
    spire.position.y = 4.3 * scale;
    spire.rotation.y = Math.PI / 4;
    spire.castShadow = true;
    this.obelisk.add(spire);
    this.spire = spire;

    const tip = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.55 * scale),
      new THREE.MeshStandardMaterial({ color: COLORS.rune, emissive: COLORS.rune, emissiveIntensity: 2.2 })
    );
    tip.position.y = 8.3 * scale;
    tip.userData.tip = true;
    this.obelisk.add(tip);
    this.obeliskTip = tip;

    this.runeRings = [];
    for (let i = 0; i < ringCount; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry((1.5 + i * 0.6) * scale, 0.05 * scale, 6, 24),
        new THREE.MeshStandardMaterial({
          color: COLORS.rune,
          emissive: COLORS.rune,
          emissiveIntensity: 1.5,
          transparent: true,
          opacity: 0.8,
        })
      );
      ring.position.y = (3.4 + i * 1.6) * scale;
      ring.rotation.x = Math.PI / 2 + 0.25 * (i % 2 ? -1 : 1);
      this.obelisk.add(ring);
      this.runeRings.push(ring);
    }

    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.7 * scale, 2.1 * scale, 0.8, 6), rockMat(0x241a2e));
    base.position.y = 0.4;
    this.obelisk.add(base);

    this.obelisk.position.set(OBELISK_POS.x, 0.85, OBELISK_POS.z);
    this.add(this.obelisk);
  }

  buildPortal(scale = 1) {
    this.portal = new THREE.Group();
    const outer = new THREE.Mesh(
      new THREE.TorusGeometry(3.1 * scale, 0.22, 8, 40),
      new THREE.MeshStandardMaterial({ color: 0x2a1a3a, emissive: COLORS.eldritch, emissiveIntensity: 1.1, roughness: 0.4 })
    );
    this.portal.add(outer);
    const inner = new THREE.Mesh(
      new THREE.TorusGeometry(2.55 * scale, 0.1, 6, 36),
      new THREE.MeshStandardMaterial({ color: 0x1a1030, emissive: COLORS.kinaeticGlow, emissiveIntensity: 1.6 })
    );
    this.portal.add(inner);
    this.portalRings = [outer, inner];
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(2.6 * scale, 36),
      new THREE.MeshBasicMaterial({ color: 0x0b0618, transparent: true, opacity: 0.92, side: THREE.DoubleSide })
    );
    this.portal.add(disc);
    const swirl = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 2.4 * scale, 24, 1, 0, Math.PI * 1.4),
      new THREE.MeshBasicMaterial({ color: COLORS.eldritch, transparent: true, opacity: 0.18, side: THREE.DoubleSide })
    );
    swirl.position.z = 0.02;
    this.portal.add(swirl);
    this.portalSwirl = swirl;

    this.portal.position.set(PORTAL_POS.x, PORTAL_POS.y, PORTAL_POS.z);
    this.portal.rotation.x = -0.12;
    this.add(this.portal);
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
    this.add(this.embers);
  }

  // ---- the obelisk's death --------------------------------------------------

  // The Inquisitor's Judgement: the spire bursts into shards that scatter and
  // die, the violet light gutters out, the portal collapses to a crack.
  async shatterObelisk(tweens) {
    if (!this.obelisk || this.obeliskBroken) return;
    this.obeliskBroken = true;

    const origin = this.obelisk.position;
    this.obelisk.visible = false;

    // a jagged stump stays behind
    const stump = new THREE.Mesh(
      jitterGeometry(new THREE.CylinderGeometry(0.8, 1.6, 1.4, 5), 0.2),
      new THREE.MeshStandardMaterial({
        color: COLORS.obelisk, roughness: 0.5, metalness: 0.3, flatShading: true,
        emissive: COLORS.rune, emissiveIntensity: 0.06,
      })
    );
    stump.position.set(origin.x, 0.7, origin.z);
    this.add(stump);

    const shards = [];
    const shardMat = new THREE.MeshStandardMaterial({
      color: COLORS.obelisk,
      roughness: 0.35,
      metalness: 0.4,
      flatShading: true,
      emissive: COLORS.rune,
      emissiveIntensity: 0.6,
      transparent: true,
    });
    for (let i = 0; i < 22; i++) {
      const shard = new THREE.Mesh(new THREE.TetrahedronGeometry(0.25 + Math.random() * 0.55), shardMat.clone());
      const a = Math.random() * Math.PI * 2;
      shard.position.set(
        origin.x + Math.cos(a) * 0.4,
        1 + Math.random() * 8.5,
        origin.z + Math.sin(a) * 0.4
      );
      shard.userData.start = shard.position.clone();
      shard.userData.vel = new THREE.Vector3(
        Math.cos(a) * (1.5 + Math.random() * 4),
        1.5 + Math.random() * 4.5,
        Math.sin(a) * (1.5 + Math.random() * 3)
      );
      shard.userData.spin = new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      shards.push(shard);
      this.add(shard);
    }

    const startLight = this.obeliskLight ? this.obeliskLight.intensity : 0;
    const flash = new THREE.PointLight(0xffffff, 260, 40, 2);
    flash.position.set(origin.x, 5, origin.z);
    this.add(flash);

    const D = 1.9;
    const G = 6.5;
    await tweens.run({
      duration: D,
      ease: (t) => t,
      onUpdate: (e) => {
        const t = e * D;
        for (const s of shards) {
          const { start, vel, spin } = s.userData;
          s.position.set(
            start.x + vel.x * t,
            Math.max(0.15, start.y + vel.y * t - G * t * t),
            start.z + vel.z * t
          );
          s.rotation.set(spin.x * t, spin.y * t, spin.z * t);
          s.material.opacity = e < 0.55 ? 1 : 1 - (e - 0.55) / 0.45;
          s.material.emissiveIntensity = 0.6 * (1 - e);
        }
        flash.intensity = 260 * Math.max(0, 1 - e * 3);
        if (this.obeliskLight) this.obeliskLight.intensity = startLight * (1 - e);
        if (this.portalSwirl) this.portalSwirl.material.opacity = 0.18 * (1 - e);
        if (this.portalRings) {
          this.portalRings[0].material.emissiveIntensity = 1.1 * (1 - e * 0.85);
          this.portalRings[1].material.emissiveIntensity = 1.6 * (1 - e * 0.85);
        }
      },
    });
    for (const s of shards) {
      this.stageGroup.remove(s);
      s.geometry.dispose();
      s.material.dispose();
    }
    this.stageGroup.remove(flash);
    if (this.obeliskLight) this.obeliskLight.intensity = 0;
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
    for (let i = 0; i < this.lanterns.length; i++) {
      const l = this.lanterns[i];
      l.pivot.rotation.z = Math.sin(t * 0.9 + l.phase) * 0.08;
      l.pivot.rotation.x = Math.sin(t * 0.7 + l.phase * 1.6) * 0.06;
      l.glow.material.emissiveIntensity = 2 + Math.sin(t * 6 + l.phase) * 0.35;
    }
    for (const card of this.floatCards) {
      card.position.y = 2.5 + Math.sin(t * 1.4 + card.userData.floatPhase) * 0.12;
      card.rotation.y = t * 0.5 + card.userData.floatPhase;
    }
    if (this.fireFlame) {
      const n = Math.sin(t * 8.7) * 0.5 + Math.sin(t * 14.3) * 0.5;
      this.fireFlame.scale.set(1 + n * 0.15, 1 + n * 0.3, 1 + n * 0.15);
      if (this.fireLight) this.fireLight.intensity = 36 + n * 9;
    }
    if (this.forgeLight) this.forgeLight.intensity = 18 + Math.sin(t * 7.3) * 5;

    if (!this.obeliskBroken && this.obeliskLight && this.obelisk) {
      this.obeliskLight.intensity = 55 + Math.sin(t * 2.2) * 12;
    }
    if (!this.obeliskBroken && this.obeliskTip) {
      this.obeliskTip.rotation.y += dt * 1.2;
      this.spire.material.emissiveIntensity = 0.22 + Math.sin(t * 2.2) * 0.1;
      for (let i = 0; i < this.runeRings.length; i++) {
        this.runeRings[i].rotation.z += dt * (i % 2 ? -0.5 : 0.7);
      }
    }

    if (this.portal) {
      this.portalRings[0].rotation.z += dt * 0.4;
      this.portalRings[1].rotation.z -= dt * 0.7;
      this.portalSwirl.rotation.z -= dt * 1.6;
    }

    if (this.embers) {
      const pos = this.embers.geometry.attributes.position;
      for (let i = 0; i < this.emberData.length; i++) {
        const d = this.emberData[i];
        let y = pos.getY(i) + d.speed * dt;
        if (y > 10) y = 0;
        pos.setY(i, y);
        pos.setX(i, pos.getX(i) + Math.sin(t * 0.8 + d.drift) * dt * 0.15);
      }
      pos.needsUpdate = true;
    }

    // Camera rig: glance blend + side view blend + Kinaeto focus + breathing.
    if (this.rigEnabled) {
      this.glance += (this.glanceTarget - this.glance) * Math.min(dt * 3.2, 1);
      this.side += (this.sideTarget - this.side) * Math.min(dt * 2.6, 1);
      this.focus += (this.focusTarget - this.focus) * Math.min(dt * 2.4, 1);
    }
    const P = CAMERA_POSES;
    const basePose = P[this.basePose] || P.default;
    const glancePose = this.glance < 0 ? P.bottom : P.top;
    const g = Math.abs(this.glance);
    const pose = this._pose;
    pose.pos.fromArray(basePose.pos);
    pose.look.fromArray(basePose.look);
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
    if (this.walls) {
      const litRight = Math.max(0, -this.side);
      const litLeft = Math.max(0, this.side);
      this.walls.right.light.intensity = litRight * 60;
      this.walls.left.light.intensity = litLeft * 60;
      this.walls.right.mat.emissiveIntensity = 0.08 + litRight * 1.05;
      this.walls.left.mat.emissiveIntensity = 0.08 + litLeft * 1.05;
    }

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
