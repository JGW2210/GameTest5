// The hub — the cult's refuge between battles. A cave with three stations:
//   the Altar of Names (deck manager), the Cold Forge (smith upgrades), and
//   the Severed Link (Kinaeto, who confirms you're ready and opens the map).
// Stations are raycast in the 3D scene; their workings open as DOM panels.

import { DIALOGUE, CARDS } from '#game/data.js';
import {
  DECK_MIN, DECK_MAX, deckCount, addToDeck, removeFromDeck,
  canUpgrade, applyUpgrade, forgeChargesLeft, effectiveCards,
} from '#game/meta.js';

const TYPE_GLYPHS = { fist: '✊', palm: '✋', sign: '🖐', object: '⛰', tk: '◉' };
const HUB_HINT = 'The refuge is quiet. Choose a station — altar, forge, or the severed link.';

export class Hub {
  // ctx: {world, board, hud, cardHand, meta, kinaetoSpeaks, onStartBattle}
  constructor(ctx) {
    this.ctx = ctx;
    this.panelEl = document.getElementById('panel');
    this.hoverStation = null;
    this.busy = false;
    this.active = false;
  }

  enter() {
    const { world, board, hud, cardHand } = this.ctx;
    this.active = true;
    world.setStage('hub');
    board.setVisible(false);
    board.clearWarnings();
    hud.setBattleUi(false);
    cardHand.group.visible = false;
    hud.setHint(HUB_HINT);
    hud.setEndTurnEnabled(false);
  }

  exit() {
    this.active = false;
    this.closePanel();
    if (this.hoverStation) this.hoverStation.group.scale.setScalar(1);
    this.hoverStation = null;
    document.body.style.cursor = 'default';
    this.ctx.hud.setHint('');
    this.ctx.hud.setBattleUi(true);
  }

  stationAt(raycaster) {
    for (const st of this.ctx.world.stations) {
      if (raycaster.intersectObject(st.group, true).length) return st;
    }
    return null;
  }

  onPointerMove(raycaster) {
    if (!this.active || this.busy || this.isPanelOpen()) return;
    const st = this.stationAt(raycaster);
    if (st !== this.hoverStation) {
      if (this.hoverStation) this.hoverStation.group.scale.setScalar(1);
      this.hoverStation = st;
      if (st) st.group.scale.setScalar(1.06);
      this.ctx.hud.setHint(st ? st.label : HUB_HINT);
    }
    document.body.style.cursor = st ? 'pointer' : 'default';
  }

  onPointerDown(raycaster) {
    if (!this.active || this.busy || this.isPanelOpen()) return;
    const st = this.stationAt(raycaster);
    if (!st) return;
    if (st.kind === 'deck') this.openDeckPanel();
    else if (st.kind === 'smith') this.openSmithPanel();
    else this.portalSequence();
  }

  async portalSequence() {
    this.busy = true;
    document.body.style.cursor = 'default';
    await this.ctx.kinaetoSpeaks(DIALOGUE.hubWelcome);
    this.busy = false;
    this.openMapPanel();
  }

  // ---- panels ---------------------------------------------------------------

  isPanelOpen() {
    return this.panelEl.classList.contains('show');
  }

  closePanel() {
    this.panelEl.classList.remove('show');
    this.panelEl.innerHTML = '';
    if (this.active) this.ctx.hud.setHint(HUB_HINT);
  }

  showPanel(html, onWire) {
    this.ctx.hud.setHint('');
    this.panelEl.innerHTML = `<div class="panel-box">${html}</div>`;
    this.panelEl.classList.add('show');
    const closeBtn = this.panelEl.querySelector('.panel-close');
    if (closeBtn) closeBtn.addEventListener('click', () => this.closePanel());
    if (onWire) onWire(this.panelEl);
  }

  cardRowHtml(key, def, middle, buttons) {
    const stars = def.forged ? ` <span class="stars">${'★'.repeat(def.forged)}</span>` : '';
    const stats = def.type === 'tk'
      ? `Rite — ${def.desc}`
      : `${def.cost}🔥 · ⚔ ${def.atk} · ♥ ${def.hp} — ${def.desc}`;
    return `
      <div class="card-row" data-key="${key}">
        <div class="glyph">${TYPE_GLYPHS[def.type] || '◆'}</div>
        <div class="info">
          <div class="name">${def.name}${stars}</div>
          <div class="stats">${stats}</div>
        </div>
        <div class="count">${middle}</div>
        ${buttons}
      </div>`;
  }

  // The Altar of Names: choose which owned cards march in the deck.
  openDeckPanel() {
    const { meta } = this.ctx;
    const cards = effectiveCards(meta);
    const keys = Object.keys(CARDS).filter((k) => (meta.collection[k] || 0) > 0);
    const rows = keys.map((key) => {
      const inDeck = deckCount(meta, key);
      const owned = meta.collection[key] || 0;
      return this.cardRowHtml(key, cards[key], `${inDeck} / ${owned}`, `
        <button class="deck-minus" ${inDeck === 0 ? 'disabled' : ''}>−</button>
        <button class="deck-plus" ${inDeck >= owned ? 'disabled' : ''}>+</button>`);
    }).join('');

    this.showPanel(`
      <h1>THE ALTAR OF NAMES</h1>
      <h2>Choose who marches. The rest keep the fires lit at home.</h2>
      <div class="panel-note">DECK ${meta.deck.length} — no fewer than ${DECK_MIN}, no more than ${DECK_MAX}</div>
      ${rows}
      <button class="panel-close">Done</button>
    `, (el) => {
      el.querySelectorAll('.card-row').forEach((row) => {
        const key = row.dataset.key;
        row.querySelector('.deck-plus').addEventListener('click', () => {
          const r = addToDeck(meta, key);
          if (!r.ok) this.ctx.hud.toast(r.reason);
          this.openDeckPanel();
        });
        row.querySelector('.deck-minus').addEventListener('click', () => {
          const r = removeFromDeck(meta, key);
          if (!r.ok) this.ctx.hud.toast(r.reason);
          this.openDeckPanel();
        });
      });
    });
  }

  // The Cold Forge: a few free strengthenings until a real economy arrives.
  openSmithPanel() {
    const { meta } = this.ctx;
    const cards = effectiveCards(meta);
    const charges = forgeChargesLeft(meta);
    const keys = Object.keys(CARDS).filter((k) => canUpgrade(k) && (meta.collection[k] || 0) > 0);
    const rows = keys.map((key) => {
      const def = cards[key];
      return this.cardRowHtml(key, def, '', `
        <button class="forge-btn forge-atk" ${charges === 0 ? 'disabled' : ''}>+1 ⚔</button>
        <button class="forge-btn forge-hp" ${charges === 0 ? 'disabled' : ''}>+1 ♥</button>`);
    }).join('');

    this.showPanel(`
      <h1>THE COLD FORGE</h1>
      <h2>The smith works for faith alone — for now. Each strengthening touches every copy.</h2>
      <div class="panel-note">${charges} EMBER${charges === 1 ? '' : 'S'} LEFT IN THE FORGE</div>
      ${rows}
      <button class="panel-close">Done</button>
    `, (el) => {
      el.querySelectorAll('.card-row').forEach((row) => {
        const key = row.dataset.key;
        row.querySelector('.forge-atk').addEventListener('click', () => {
          if (applyUpgrade(meta, key, 'atk')) this.openSmithPanel();
          else this.ctx.hud.toast('The forge is cold — no embers remain');
        });
        row.querySelector('.forge-hp').addEventListener('click', () => {
          if (applyUpgrade(meta, key, 'hp')) this.openSmithPanel();
          else this.ctx.hud.toast('The forge is cold — no embers remain');
        });
      });
    });
  }

  // The war map: one road for now; the rest of the world arrives later.
  openMapPanel() {
    const { meta } = this.ctx;
    const cleared = meta.battlesWon > 0;
    this.showPanel(`
      <h1>THE CRUSADE’S ROADS</h1>
      <h2>Kinaeto will carry you to the gate. The deeper roads are still dark.</h2>
      <div class="map-roads">
        <svg viewBox="0 0 520 300" fill="none">
          <path d="M 140 235 C 200 190, 250 160, 300 120 S 390 70, 420 55"
                stroke="rgba(155,108,255,0.35)" stroke-width="2" stroke-dasharray="3 8" stroke-linecap="round"/>
        </svg>
        <div class="map-node" id="map-node-1" style="left: 140px; top: 225px;">
          <div class="sigil">🜏</div>
          <div class="label">I · THE LOWER GATE</div>
          <div class="sub">${cleared ? 'held once — the crusade returns' : 'the crusade musters here'}</div>
        </div>
        <div class="map-node locked" style="left: 420px; top: 60px;">
          <div class="sigil">?</div>
          <div class="label">II · THE UPPER CAVES</div>
          <div class="sub">the way is still dark</div>
        </div>
      </div>
      <button class="panel-close">Not yet</button>
    `, (el) => {
      el.querySelector('#map-node-1').addEventListener('click', () => {
        this.closePanel();
        this.ctx.onStartBattle();
      });
    });
  }
}
