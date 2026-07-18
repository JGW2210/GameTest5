// DOM HUD: energy, turn/wave, obelisk health, telekinesis panel, dialogue box,
// warning banners, and the menu / victory / defeat screens.

const $ = (id) => document.getElementById(id);

export const PATH_NAMES = ['LEFT', 'CENTRE', 'RIGHT'];

export class Hud {
  constructor() {
    this.el = {
      turn: $('hud-turn'),
      wave: $('hud-wave'),
      energy: $('hud-energy'),
      obeliskFill: $('hud-obelisk-fill'),
      obeliskText: $('hud-obelisk-text'),
      deck: $('hud-deck'),
      discardPile: $('hud-discard'),
      tkPanel: $('tk-panel'),
      tkStatus: $('tk-status'),
      endTurn: $('btn-endturn'),
      banner: $('banner'),
      toast: $('toast'),
      dialogue: $('dialogue'),
      dialogueText: $('dialogue-text'),
      overlay: $('overlay'),
      hint: $('hint'),
    };
    this.tkButtons = [...document.querySelectorAll('.tk-btn')];
    this.onTkSelect = null;
    this.onEndTurn = null;
    this._dialogueResolve = null;
    this._toastTimer = null;
    this._bannerTimer = null;

    for (const b of this.tkButtons) {
      b.addEventListener('click', () => {
        if (b.disabled) return;
        if (this.onTkSelect) this.onTkSelect(b.dataset.power);
      });
    }
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

  setEnergy(cur, max) {
    this.el.energy.innerHTML = '';
    for (let i = 0; i < max; i++) {
      const orb = document.createElement('div');
      orb.className = 'orb' + (i < cur ? ' full' : '');
      this.el.energy.appendChild(orb);
    }
  }

  setObelisk(hp, max) {
    const frac = Math.max(hp, 0) / max;
    this.el.obeliskFill.style.width = `${frac * 100}%`;
    this.el.obeliskFill.classList.toggle('low', frac < 0.35);
    this.el.obeliskText.textContent = `OBELISK ${Math.max(hp, 0)} / ${max}`;
  }

  setCounts(deck, discard) {
    this.el.deck.textContent = `Deck ${deck}`;
    this.el.discardPile.textContent = `Discard ${discard}`;
  }

  setTk(used, max, selected) {
    this.el.tkStatus.textContent = used < max ? 'KINAETO REACHES THROUGH YOU' : 'The hand rests until next turn';
    for (const b of this.tkButtons) {
      b.disabled = used >= max;
      b.classList.toggle('selected', b.dataset.power === selected);
    }
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
          <p><b>✋ Open Palm</b> — holds its tile; only your telekinesis moves it.</p>
          <p><b>✊ Closed Fist</b> — advances; attacks foes on its tile.</p>
          <p><b>🖐 Hand Sign</b> — casts 2–5 tiles down its path; can never be moved.</p>
          <p><b>Telekinesis</b> — once per turn: Move, Push, Crush, or Trip any lawful target — even the enemy's.</p>
          <p><b>← →</b> (or swipe) — look to the cave walls. The faithful have left you messages.</p>
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
