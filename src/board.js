// The three 7-tile paths, tile highlighting, and wave-warning sigils at the
// path mouths.

import * as THREE from 'three';
import {
  PATHS, ROWS, PATH_X, rowZ, TILE_SIZE, TILE_H, OBELISK_ROW, COLORS,
} from './config.js';

export class Board {
  constructor(scene) {
    this.scene = scene;
    this.tiles = []; // tiles[path][row] = mesh
    this.tileList = [];
    this.highlighted = new Set();
    this.warnMarkers = [];
    this.time = 0;

    const geo = new THREE.BoxGeometry(TILE_SIZE, TILE_H, TILE_SIZE);
    const edgeGeo = new THREE.BoxGeometry(TILE_SIZE + 0.18, TILE_H * 0.6, TILE_SIZE + 0.18);

    for (let p = 0; p < PATHS; p++) {
      this.tiles.push([]);
      for (let r = 0; r < ROWS; r++) {
        const zone = r === OBELISK_ROW ? 'obelisk' : r <= 3 ? 'player' : 'enemy';
        const base =
          zone === 'obelisk' ? COLORS.tileObelisk : zone === 'player' ? COLORS.tilePlayer : COLORS.tileEnemy;
        const mat = new THREE.MeshStandardMaterial({
          color: base,
          roughness: 0.85,
          metalness: 0.05,
          flatShading: true,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(PATH_X[p], TILE_H / 2 + (r === OBELISK_ROW ? 0.55 : 0), rowZ(r));
        mesh.receiveShadow = true;
        mesh.userData = { isTile: true, path: p, row: r, zone, baseColor: base };
        this.scene.add(mesh);

        const edge = new THREE.Mesh(
          edgeGeo,
          new THREE.MeshStandardMaterial({ color: COLORS.tileEdge, roughness: 1, flatShading: true })
        );
        edge.position.copy(mesh.position);
        edge.position.y -= TILE_H * 0.25;
        this.scene.add(edge);

        this.tiles[p].push(mesh);
        this.tileList.push(mesh);
      }
    }

    // The Gaze of Kinaeto: soft violet markers over the watched path and a
    // dimmer herald ring at the mouth of the path it will watch next.
    this.gazePath = -1;
    this.nextGazePath = -1;
    const heraldGeo = new THREE.RingGeometry(0.4, 0.6, 24);
    this.gazeHeralds = [];
    for (let p = 0; p < PATHS; p++) {
      const ring = new THREE.Mesh(
        heraldGeo,
        new THREE.MeshBasicMaterial({ color: COLORS.rune, transparent: true, opacity: 0, side: THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(PATH_X[p], 0.32, rowZ(ROWS - 1) + 1.35);
      this.scene.add(ring);
      this.gazeHeralds.push(ring);
    }

    // Warning sigils hovering past the mouth of each path.
    const sigilGeo = new THREE.RingGeometry(0.55, 0.85, 6);
    for (let p = 0; p < PATHS; p++) {
      const mat = new THREE.MeshBasicMaterial({
        color: COLORS.warn,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
      });
      const sigil = new THREE.Mesh(sigilGeo, mat);
      sigil.rotation.x = -Math.PI / 2;
      sigil.position.set(PATH_X[p], 0.35, rowZ(ROWS - 1) + 2.3);
      const inner = new THREE.Mesh(
        new THREE.CircleGeometry(0.35, 6),
        new THREE.MeshBasicMaterial({ color: COLORS.warn, transparent: true, opacity: 0, side: THREE.DoubleSide })
      );
      inner.position.z = 0.01;
      sigil.add(inner);
      this.scene.add(sigil);
      this.warnMarkers.push({ sigil, inner, active: false });
    }
  }

  tileAt(path, row) {
    return this.tiles[path][row];
  }

  unitPosition(path, row) {
    const t = this.tileAt(path, row);
    return new THREE.Vector3(t.position.x, t.position.y + TILE_H / 2, t.position.z);
  }

  highlight(cells, colorHex) {
    for (const { path, row } of cells) {
      const tile = this.tileAt(path, row);
      tile.material.emissive.setHex(colorHex);
      tile.userData.pulse = true;
      this.highlighted.add(tile);
    }
  }

  hoverTile(tile) {
    if (this.highlighted.has(tile)) tile.userData.hover = true;
  }

  clearHover() {
    for (const t of this.highlighted) t.userData.hover = false;
  }

  clearHighlights() {
    for (const tile of this.highlighted) {
      tile.material.emissive.setHex(0x000000);
      tile.material.emissiveIntensity = 1;
      tile.userData.pulse = false;
      tile.userData.hover = false;
    }
    this.highlighted.clear();
  }

  setGaze(path, nextPath) {
    this.gazePath = path;
    this.nextGazePath = nextPath;
    for (let p = 0; p < PATHS; p++) {
      for (let r = 0; r < ROWS; r++) {
        this.tiles[p][r].userData.gaze = p === path;
      }
    }
  }

  setWarnings(paths) {
    for (let p = 0; p < PATHS; p++) {
      this.warnMarkers[p].active = paths.includes(p);
    }
  }

  clearWarnings() {
    this.setWarnings([]);
  }

  update(dt) {
    this.time += dt;
    const pulse = 0.45 + 0.3 * Math.sin(this.time * 5);
    for (const tile of this.highlighted) {
      tile.material.emissiveIntensity = tile.userData.hover ? 1.1 : pulse;
    }
    // gaze tint on unselected tiles of the watched path
    const gazeGlow = 0.14 + 0.05 * Math.sin(this.time * 2.4);
    for (const tile of this.tileList) {
      if (this.highlighted.has(tile)) continue;
      if (tile.userData.gaze) {
        tile.material.emissive.setHex(COLORS.rune);
        tile.material.emissiveIntensity = gazeGlow;
      } else if (tile.material.emissiveIntensity !== 0 && tile.material.emissive.getHex() === COLORS.rune) {
        tile.material.emissive.setHex(0x000000);
        tile.material.emissiveIntensity = 1;
      }
    }
    for (let p = 0; p < this.gazeHeralds.length; p++) {
      const h = this.gazeHeralds[p];
      const target = p === this.nextGazePath ? 0.3 + 0.15 * Math.sin(this.time * 3) : 0;
      h.material.opacity += (target - h.material.opacity) * Math.min(dt * 6, 1);
      h.rotation.z += dt * 0.5;
    }
    for (const m of this.warnMarkers) {
      const target = m.active ? 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(this.time * 4)) : 0;
      m.sigil.material.opacity += (target - m.sigil.material.opacity) * Math.min(dt * 8, 1);
      m.inner.material.opacity = m.sigil.material.opacity * 0.7;
      m.sigil.rotation.z += dt * (m.active ? 0.8 : 0.1);
    }
  }
}
