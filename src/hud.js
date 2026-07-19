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
      dream: $('dream'),
      dreamText: $('dream-text'),
      flash: $('flash'),
      obeliskSegs: $('obelisk-segs'),
      zoneUse: $('zone-use'),
      zoneBurn: $('zone-burn'),
      unitTip: $('unit-tip'),
      inspect: $('inspect'),
      inspectCard: $('inspect-card'),
      inspectIntent: $('inspect-intent'),
    };
    this.el.inspect.addEventListener('click', () => this.hideInspect());
    this.onEndTurn = null;
    this._dialogueResolve = null;
    this._dreamResolve = null;
    this._toastTimer = null;
    this._bannerTimer = null;

    this.el.endTurn.addEventListener('click', () => {
      if (!this.el.endTurn.disabled && this.onEndTurn) this.onEndTurn();
    });
    this.el.dialogue.addEventListener('click', () => this.advanceDialogue());
    this.el.dream.addEventListener('click', () => this.advanceDream());
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && (this._dialogueResolve || this._dreamResolve)) {
        e.preventDefault();
        if (this._dreamResolve) this.advanceDream();
        else this.advanceDialogue();
      }
    });
  }

  // Hide the battle chrome (turn counter, flames, end-turn) while in the hub.
  setBattleUi(on) {
    document.body.classList.toggle('no-battle-ui', !on);
  }

  // A blinding burst of holy light (the Inquisitor's Judgement).
  flash() {
    this.el.flash.classList.add('show');
    setTimeout(() => this.el.flash.classList.remove('show'), 900);
  }

  setTurn(turn) {
    this.el.turn.textContent = `Turn ${turn}`;
  }

  setWave(text) {
    this.el.wave.textContent = text;
  }

  // Impetus: a row of flames, burning while unspent. Burned cards can push
  // the row past its base length.
  setImpetus(cur, max) {
    this.el.impetus.innerHTML = '';
    const total = Math.max(cur, max);
    for (let i = 0; i < total; i++) {
      const f = document.createElement('span');
      f.className = 'flame' + (i < cur ? ' lit' : '');
      f.innerHTML =
        '<svg viewBox="0 0 24 32" width="22" height="30"><path d="M12 2 C15 8 20 11 20 19 A8 8 0 0 1 4 19 C4 13 8 10 9 6 C10 9 12 10 13 12 C14 8 12 5 12 2 Z"/></svg>';
      this.el.impetus.appendChild(f);
    }
  }

  // While a card is dragged the flames advertise the burn drop-zone.
  setBurnHint(on) {
    const label = document.getElementById('impetus-label');
    label.textContent = on ? 'BURN HERE +1' : 'IMPETUS';
    label.classList.toggle('burnable', on);
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
    // pip dividers, one segment per point of stone
    if (this._obeliskSegMax !== max) {
      this._obeliskSegMax = max;
      const seg = 100 / max;
      this.el.obeliskSegs.style.backgroundImage =
        `repeating-linear-gradient(90deg, transparent 0, transparent calc(${seg}% - 1.5px), #0d0708 calc(${seg}% - 1.5px), #0d0708 ${seg}%)`;
    }
  }

  // ---- drag drop-zones (USE on the right, BURN by the flames) --------------

  // state: null (hidden) | 'drag' (both zones live) | 'placing' (use zone
  // stays lit while a target is chosen)
  setDropZones(state, useEnabled = true) {
    this.el.zoneUse.classList.toggle('show', state !== null);
    this.el.zoneUse.classList.toggle('disabled', !useEnabled);
    this.el.zoneUse.classList.toggle('armed', state === 'placing');
    this.el.zoneBurn.classList.toggle('show', state === 'drag');
    if (!state) {
      this.el.zoneUse.classList.remove('hot');
      this.el.zoneBurn.classList.remove('hot');
    }
  }

  setZoneHot(zone, hot) {
    const el = zone === 'use' ? this.el.zoneUse : this.el.zoneBurn;
    el.classList.toggle('hot', hot);
  }

  zoneAt(clientX, clientY) {
    for (const [name, el] of [['burn', this.el.zoneBurn], ['use', this.el.zoneUse]]) {
      if (!el.classList.contains('show')) continue;
      const r = el.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) return name;
    }
    return null;
  }

  // ---- unit hover tooltip & card inspector ---------------------------------

  showUnitTip(text, x, y) {
    const tip = this.el.unitTip;
    tip.textContent = text;
    tip.style.left = `${Math.min(x + 18, window.innerWidth - 260)}px`;
    tip.style.top = `${y - 14}px`;
    tip.classList.add('show');
  }

  hideUnitTip() {
    this.el.unitTip.classList.remove('show');
  }

  showInspect(dataUrl, intentText) {
    this.el.inspectCard.src = dataUrl;
    this.el.inspectIntent.textContent = intentText || '';
    this.el.inspect.classList.add('show');
  }

  hideInspect() {
    this.el.inspect.classList.remove('show');
  }

  get inspectOpen() {
    return this.el.inspect.classList.contains('show');
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
  // every line has been shown and dismissed. While a dialogue is open the hint
  // and toast lines hide (body class) so centre-screen text never stacks.
  dialogue(lines) {
    this._dialogueQueue = Array.isArray(lines) ? lines.slice() : [lines];
    this.el.dialogue.classList.add('show');
    document.body.classList.add('dialogue-open');
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
      document.body.classList.remove('dialogue-open');
      const r = this._dialogueResolve;
      this._dialogueResolve = null;
      r();
    }
  }

  // Dock the dialogue box beneath Kinaeto during his close-up.
  setDialogueDock(focused) {
    this.el.dialogue.classList.toggle('focus', focused);
  }

  // The dream: a slow fade into the only room they cannot burn. Kinaeto's
  // words drift up one line at a time; click (or Space) advances.
  dream(lines) {
    this._dreamQueue = lines.slice();
    this.el.dream.classList.add('show');
    return new Promise((resolve) => {
      this._dreamResolve = resolve;
      this.el.dreamText.textContent = this._dreamQueue.shift();
    });
  }

  advanceDream() {
    if (!this._dreamResolve) return;
    if (this._dreamQueue.length > 0) {
      this.el.dreamText.textContent = this._dreamQueue.shift();
    } else {
      this.el.dream.classList.remove('show');
      const r = this._dreamResolve;
      this._dreamResolve = null;
      // let the fade-out finish before the world returns
      setTimeout(r, 700);
    }
  }

  // Full screens. onAction receives the clicked button's key.
  // opts.firstRun — the menu offers the tutorial only until it has been seen.
  showScreen(kind, onAction, opts = {}) {
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
        body: opts.firstRun
          ? 'In the ceremony grounds beneath the mountain, Kinaeto — hand, eye, and patience — gathers his faithful for a sermon. The church is closer than anyone knows.'
          : 'The first sanctuary is ash and the obelisk is gravel. In a deeper cave, the cult begins again.',
        btns: opts.firstRun
          ? [{ key: 'tutorial', label: 'Begin the First Night' }]
          : [
              { key: 'hub', label: 'Enter the Sanctum' },
              { key: 'tutorial', label: 'Relive the First Night' },
            ],
        extra: `<div class="rules">
          <p><b>Impetus</b> 🔥 — flame energy that calls troops. A fixed measure each turn; drag any card into the flames to burn it for +1.</p>
          <p><b>Ranks</b> — tiles hold up to 3 followers a side; allies never block allies. On contested tiles <i>everyone</i> strikes each turn, and victors surge onward the same turn.</p>
          <p><b>Kinaetic focus</b> — Kinaeto reaches through you once per turn: click a unit to Move or Push it, or cast a Rite card (Crush, Trip, Beckoning).</p>
          <p><b>✋ Open Palm</b> — holds its tile. <b>✊ Closed Fist</b> — advances; attacks foes on its tile. <b>🖐 Hand Sign</b> — casts down its path; can never be moved.</p>
          <p><b>The Gaze</b> — each turn the Eye watches one path: cult units there fight harder, and rites cast on that path preserve your focus. The next path is foretold.</p>
          <p><b>Intents</b> — every crusader shows what it will do next: advance, strike, volley, siege, or worse.</p>
          <p><b>← →</b> (or swipe) — take the flanks. The faithful have left you messages on the walls.</p>
        </div>`,
      },
      victory: {
        title: 'THE GATE HOLDS',
        sub: 'Wave after wave broke on your faithful. The obelisk still sings.',
        body: 'The crusade will lick its wounds and come back meaner. Tend to the flock while the roads are quiet.',
        btns: [{ key: 'hub', label: 'Return to the Sanctum' }],
      },
      defeat: {
        title: 'THE OBELISK FALLS SILENT',
        sub: 'Kinaeto’s grip on this plane thins to a thread.',
        body: 'Threads can be rewoven. Regather the faithful and try the gate again.',
        btns: [{ key: 'hub', label: 'Return to the Sanctum' }],
      },
    }[kind];

    const btnsHtml = content.btns
      .map((b, i) => `<button class="overlay-btn${i > 0 ? ' secondary' : ''}" data-key="${b.key}">${b.label}</button>`)
      .join('');
    o.innerHTML = `
      <div class="panel">
        <h1>${content.title}</h1>
        <h2>${content.sub}</h2>
        <p>${content.body}</p>
        ${content.extra || ''}
        <div class="overlay-btns">${btnsHtml}</div>
      </div>`;
    o.classList.add('show');
    o.querySelectorAll('.overlay-btn').forEach((btn) => {
      btn.addEventListener('click', () => onAction && onAction(btn.dataset.key));
    });
  }
}
