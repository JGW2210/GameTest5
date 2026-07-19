// The hub — the cult's refuge between battles. A cave with three stations:
//   the Altar of Names (deck manager), the Cold Forge (smith upgrades), and
//   the Severed Link (Kinaeto, who confirms you're ready and opens the map).
// Stations are raycast in the 3D scene; their workings open as DOM panels.

import { DIALOGUE, CARDS } from '#game/data.js';
import { setCardSource, cardFaceDataURL } from '#game/cards3d.js';
import {
  DECK_MIN, DECK_MAX, deckCount, addToDeck, removeFromDeck,
  canUpgrade, applyUpgrade, forgeChargesLeft, effectiveCards,
} from '#game/meta.js';

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
    // card faces in the panels must show the smith's work
    setCardSource(effectiveCards(this.ctx.meta));
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

  // A cell in the panel grids: the card exactly as it appears in battle.
  cardCellHtml(key, { count = '', buttons = '', dim = false } = {}) {
    return `
      <div class="card-cell${dim ? ' none-in-deck' : ''}" data-key="${key}">
        <img src="${cardFaceDataURL(key)}" alt="${key}" draggable="false" />
        ${count ? `<div class="cell-count">${count}</div>` : ''}
        ${buttons ? `<div class="cell-btns">${buttons}</div>` : ''}
      </div>`;
  }

  // The Altar of Names: the cards themselves, as they appear in battle.
  openDeckPanel() {
    const { meta } = this.ctx;
    const keys = Object.keys(CARDS).filter((k) => (meta.collection[k] || 0) > 0);
    const cells = keys.map((key) => {
      const inDeck = deckCount(meta, key);
      const owned = meta.collection[key] || 0;
      return this.cardCellHtml(key, {
        dim: inDeck === 0,
        count: `${inDeck} <span class="dim">of ${owned} march</span>`,
        buttons: `
          <button class="deck-minus" ${inDeck === 0 ? 'disabled' : ''}>−</button>
          <button class="deck-plus" ${inDeck >= owned ? 'disabled' : ''}>+</button>`,
      });
    }).join('');

    this.showPanel(`
      <h1>THE ALTAR OF NAMES</h1>
      <h2>Choose who marches. The rest keep the fires lit at home.</h2>
      <div class="panel-note">DECK ${meta.deck.length} — no fewer than ${DECK_MIN}, no more than ${DECK_MAX}</div>
      <div class="card-grid">${cells}</div>
      <button class="panel-close">Done</button>
    `, (el) => {
      el.querySelectorAll('.card-cell').forEach((cell) => {
        const key = cell.dataset.key;
        cell.querySelector('.deck-plus').addEventListener('click', () => {
          const r = addToDeck(meta, key);
          if (!r.ok) this.ctx.hud.toast(r.reason);
          this.openDeckPanel();
        });
        cell.querySelector('.deck-minus').addEventListener('click', () => {
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
    const charges = forgeChargesLeft(meta);
    const keys = Object.keys(CARDS).filter((k) => canUpgrade(k) && (meta.collection[k] || 0) > 0);
    const cells = keys.map((key) =>
      this.cardCellHtml(key, {
        buttons: `
          <button class="forge-atk" ${charges === 0 ? 'disabled' : ''}>+1 ⚔</button>
          <button class="forge-hp" ${charges === 0 ? 'disabled' : ''}>+1 ♥</button>`,
      })
    ).join('');

    this.showPanel(`
      <h1>THE COLD FORGE</h1>
      <h2>The smith works for faith alone — for now. Each strengthening touches every copy.</h2>
      <div class="panel-note">${charges} EMBER${charges === 1 ? '' : 'S'} LEFT IN THE FORGE</div>
      <div class="card-grid">${cells}</div>
      <button class="panel-close">Done</button>
    `, (el) => {
      el.querySelectorAll('.card-cell').forEach((cell) => {
        const key = cell.dataset.key;
        cell.querySelector('.forge-atk').addEventListener('click', () => {
          if (applyUpgrade(meta, key, 'atk')) {
            setCardSource(effectiveCards(meta)); // re-render faces with the new stats
            this.openSmithPanel();
          } else {
            this.ctx.hud.toast('The forge is cold — no embers remain');
          }
        });
        cell.querySelector('.forge-hp').addEventListener('click', () => {
          if (applyUpgrade(meta, key, 'hp')) {
            setCardSource(effectiveCards(meta));
            this.openSmithPanel();
          } else {
            this.ctx.hud.toast('The forge is cold — no embers remain');
          }
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
        <div class="map-node" id="map-node-1" style="left: 27%; top: 72%;">
          <div class="sigil">🜏</div>
          <div class="label">I · THE LOWER GATE</div>
          <div class="sub">${cleared ? 'held once — the crusade returns' : 'the crusade musters here'}</div>
        </div>
        <div class="map-node locked" style="left: 81%; top: 20%;">
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
