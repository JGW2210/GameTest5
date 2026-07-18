// DOM HUD: energy, turn/wave, obelisk health, telekinesis panel, dialogue box,
// warning banners, and the menu / victory / defeat screens.

const $ = (id) => document.getElementById(id);

export const PATH_NAMES = ['LEFT', 'CENTRE', 'RIGHT'];

export class Hud {
  constructor() {
    this.el = {
      turn: $('hud-turn'),
      wave: $('hud-wave'),
      impetus: $('hud-impetus'),
      kinaetic: $('hud-kinaetic'),
      kinaeticWrap: $('kinaetic-wrap'),
      obeliskFill: $('hud-obelisk-fill'),
      obeliskText: $('hud-obelisk-text'),
      gaze: $('hud-gaze'),
      deck: $('hud-deck'),
      discardPile: $('hud-discard'),
      endTurn: $('btn-endturn'),
      banner: $('banner'),
      toast: $('toast'),
      dialogue: $('dialogue'),
      dialogueText: $('dialogue-text'),
      overlay: $('overlay'),
      hint: $('hint'),
    };
    this.onEndTurn = null;
    this._dialogueResolve = null;
    this._toastTimer = null;
    this._bannerTimer = null;

    this.el.endTurn.addEventListener('click', () => {
      if (!this.el.endTurn.disabled && this.onEndTurn) this.onEndTurn();
    });
    this.el.dialogue.addEventListener('click', () => this.advanceDialogue());
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && this._dialogueResolve) {
        e.preventDefault();
        this.advanceDialogue();
      }
    });
  }

  setTurn(turn) {
    this.el.turn.textContent = `Turn ${turn}`;
  }

  setWave(text) {
    this.el.wave.textContent = text;
  }

  // Impetus: a row of flames, burning while unspent.
  setImpetus(cur, max) {
    this.el.impetus.innerHTML = '';
    for (let i = 0; i < max; i++) {
      const f = document.createElement('span');
      f.className = 'flame' + (i < cur ? ' lit' : '');
      f.innerHTML =
        '<svg viewBox="0 0 24 32" width="22" height="30"><path d="M12 2 C15 8 20 11 20 19 A8 8 0 0 1 4 19 C4 13 8 10 9 6 C10 9 12 10 13 12 C14 8 12 5 12 2 Z"/></svg>';
      this.el.impetus.appendChild(f);
    }
  }

  // Kinaetic focus: the eye is open while the turn's single use remains.
  setKinaetic(available) {
    this.el.kinaeticWrap.classList.toggle('spent', !available);
  }

  setObelisk(hp, max) {
    const frac = Math.max(hp, 0) / max;
    this.el.obeliskFill.style.width = `${frac * 100}%`;
    this.el.obeliskFill.classList.toggle('low', frac < 0.35);
    this.el.obeliskText.textContent = `OBELISK ${Math.max(hp, 0)} / ${max}`;
  }

  setGaze(current, next) {
    this.el.gaze.textContent = `THE EYE WATCHES ${current} · NEXT ${next}`;
  }

  setCounts(deck, discard) {
    this.el.deck.textContent = `Deck ${deck}`;
    this.el.discardPile.textContent = `Discard ${discard}`;
  }

  setEndTurnEnabled(enabled) {
    this.el.endTurn.disabled = !enabled;
  }

  setHint(text) {
    this.el.hint.textContent = text || '';
    this.el.hint.classList.toggle('show', !!text);
  }

  banner(text, cls = '') {
    const b = this.el.banner;
    b.textContent = text;
    b.className = `show ${cls}`;
    clearTimeout(this._bannerTimer);
    this._bannerTimer = setTimeout(() => (b.className = ''), 3400);
  }

  toast(text) {
    const t = this.el.toast;
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  // Shows lines one at a time; only a click (or Space) advances. Resolves when
  // every line has been shown and dismissed.
  dialogue(lines) {
    this._dialogueQueue = Array.isArray(lines) ? lines.slice() : [lines];
    this.el.dialogue.classList.add('show');
    return new Promise((resolve) => {
      this._dialogueResolve = resolve;
      this.nextDialogueLine();
    });
  }

  nextDialogueLine() {
    this.el.dialogueText.textContent = this._dialogueQueue.shift();
  }

  advanceDialogue() {
    if (!this._dialogueResolve) return;
    if (this._dialogueQueue.length > 0) {
      this.nextDialogueLine();
    } else {
      this.el.dialogue.classList.remove('show');
      const r = this._dialogueResolve;
      this._dialogueResolve = null;
      r();
    }
  }

  // Dock the dialogue box beneath Kinaeto during his close-up.
  setDialogueDock(focused) {
    this.el.dialogue.classList.toggle('focus', focused);
  }

  showScreen(kind, onAction) {
    const o = this.el.overlay;
    if (!kind) {
      o.classList.remove('show');
      o.innerHTML = '';
      return;
    }
    const content = {
      menu: {
        title: 'KINAETO',
        sub: 'Beneath the Flame — a roguelike deckbuilder of telekinetic faith',
        body: 'The church marches on your cave. Three paths lead to the obelisk that ties Kinaeto — hand, eye, and patience — to this plane. Draw your followers. Hold the gate.',
        btn: 'Begin the Vigil',
        extra: `<div class="rules">
          <p><b>Impetus</b> 🔥 — flame energy that calls troops. A fixed measure each turn.</p>
          <p><b>Kinaetic focus</b> — Kinaeto reaches through you once per turn: click a unit to Move or Push it, or cast a Rite card (Crush, Trip, Beckoning).</p>
          <p><b>✋ Open Palm</b> — holds its tile. <b>✊ Closed Fist</b> — advances; attacks foes on its tile. <b>🖐 Hand Sign</b> — casts down its path; can never be moved.</p>
          <p><b>Cards</b> — 5 to open, 3 each turn. Every follower acts the moment it lands.</p>
          <p><b>The Gaze</b> — each turn the Eye watches one path: cult units there fight harder, and rites cast on that path preserve your focus. The next path is foretold.</p>
          <p><b>Intents</b> — every crusader shows what it will do next: advance, strike, volley, siege, or worse.</p>
          <p><b>← →</b> (or swipe) — take the flanks. The faithful have left you messages on the walls.</p>
          <p>Survive 4 waves. The 4th brings their Saint-Commander up the centre path.</p>
        </div>`,
      },
      victory: {
        title: 'THE GATE HOLDS',
        sub: 'Wave after wave broke on your faithful. The obelisk still sings.',
        body: 'This prototype ends here — the crusade will return with more battles, new followers, and darker paths.',
        btn: 'Stand Vigil Again',
      },
      defeat: {
        title: 'THE OBELISK FALLS SILENT',
        sub: 'Kinaeto’s grip on this plane thins to a thread.',
        body: 'Threads can be rewoven. Begin again, shepherd.',
        btn: 'Begin Again',
      },
    }[kind];

    o.innerHTML = `
      <div class="panel">
        <h1>${content.title}</h1>
        <h2>${content.sub}</h2>
        <p>${content.body}</p>
        ${content.extra || ''}
        <button id="overlay-btn">${content.btn}</button>
      </div>`;
    o.classList.add('show');
    $('overlay-btn').addEventListener('click', () => onAction && onAction());
  }
}
