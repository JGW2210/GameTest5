# KINAETO — Beneath the Flame

A roguelike deck-builder prototype built with [Three.js](https://threejs.org/). You are the
leader of a cult sheltering in a torch-lit cave, backed by **Kinaeto** — a benevolent
Lovecraftian god who manifests as a great hand with an eye in its palm, reaching through a
portal above the obelisk that ties him to the material plane. A feudal church has declared
your god evil and marched a crusade on your gate.

## Playing

Open the deployed page (GitHub Pages, see below) or run locally:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

No build step — plain ES modules with a vendored copy of Three.js (`vendor/`), so it runs
from any static file server.

## The battle

Three paths — **left, centre, right** — lead to the back entrance of the obelisk room.
Each path is 7 tiles: the top tile sits **inside the obelisk room**, the next 3 are **your
half**, the bottom 3 are the **enemy half**. Enemies emerge at the path mouths and advance
tile by tile toward the obelisk; if they reach it, they batter it down. Lose the obelisk
and the battle is lost. Defeat every wave and it is won.

You start with **5 cards** and draw **3 more each turn** (hand cap of 8 — undrawn cards
wait in the deck); *Kinaeto's Beckoning* rite cards draw extra. Two resources drive a turn:

- **Impetus** 🔥 — flame energy that pays for followers. A fixed measure every turn; it
  never grows.
- **Kinaetic focus** — Kinaeto reaches through you **once per turn**: either click a unit
  and choose a tile to Move/Push it, or cast a **Kinaetic Rite** card — *Crush* (3 damage),
  *Trip* (stun), or *Beckoning* (draw 3). Rites cost no Impetus.

Tiles are ranks, not squares: each holds up to **3 total unit size per side** (the
Braced Stone is size 2, the boss size 3), so allies never block allies and waves arrive
massed at the path mouths. When a tile is contested, **every unit on it strikes once per
turn** — your stack first, in arrival order, against the front crusader; survivors hit
your front unit back. The turn resolves in phases (casts → clashes → movement → enemy
action), so a stack that clears its tile advances the same turn. Any card can be
**burned** — dragged into the Impetus flames — for +1 Impetus (up to 8).

Combat runs on unit engines rather than flat stat trades:

- **Arrival cries** — every follower acts when placed (the Zealot spits fire, the Warden
  raises a 2-point ward, the Fleet Cultist is already running, the Acolyte draws a card).
- **Keywords** — RAGE (attack grows with every strike), ARMOR (flat damage reduction),
  WARD (absorbs damage first), SWEEP (the Eye of Kinaeto hits everything on its path),
  and on-death triggers (a slain Zealot burns its killer).
- **The Gaze of Kinaeto** — each turn the Eye watches one path: cult units there get
  +1 attack and +1 armor, and rites cast on that path don't consume your Kinaetic focus.
  The next turn's gaze is telegraphed a turn ahead — chase it with Move and Push.
- **Enemy intents** — every crusader floats a glowing symbol showing its next action:
  advance, strike, volley, siege the obelisk, ability, or wait.

Follower types:

| Type | Behaviour |
| --- | --- |
| ✋ **Open Palm** (defensive) | Holds its tile. Only your telekinesis moves it. |
| ✊ **Closed Fist** (attacker) | Advances at end of turn — unless an enemy shares its tile, then it attacks. |
| 🖐 **Hand Sign** (magic) | Casts 2–5 tiles along its path. Can **never** be moved, even by telekinesis — it would sever its connection to Kinaeto. |
| ⛰ **Relic** (object) | Inert obstacle that blocks the path. Telekinesis can hurl it anywhere. |

Base units may be placed on the first two tiles of your half (or in the obelisk room);
**fast** units may also be placed on the third tile. Only telekinesis can put a unit deeper.

### Telekinesis

Click any unit (yours *or* theirs — Hand Signs and the boss refuse) and Kinaeto shows
where he can carry it: adjacent tiles glow for a **Move**, two-tile throws along the path
glow for a **Push** (including hurling your own units into the enemy half). Crush and
Trip live in your deck as rite cards dragged onto a target unit.

### Waves

Battles are 4 waves. Wave 1 is forewarned at the start of turn 1 and emerges when the turn
ends. Wave 2 is forewarned at the end of turn 4 and emerges at the end of turn 5; wave 3
follows the same rhythm (warned end of 8, emerges end of 9). At the end of turn 10 the
boss wave is forewarned, and on turn 11 **Saint-Commander Aurel** emerges — always on the
centre path — too heavy to Move or Push, shrugging off half of any Crush, and consecrating
his whole path every second turn.

## Controls

- **Drag a card** from the fan onto a glowing tile to place a follower — cards tilt and
  spring toward the cursor, and the dragged card follows it
- **Click a unit** to grab it with Kinaeto's hand, then click a glowing tile (teal = Move,
  violet = Push); drag rite cards onto units (or just upward, for Beckoning)
- **Right-click / Esc** cancels; **End Turn** resolves the round
- **Camera glance**: move the cursor to the bottom of the screen to peek at the path
  mouths (and incoming-wave sigils) above your hand; move it to the top to frame the
  full obelisk. During dialogue the camera pans up to Kinaeto himself
- **Click or Space** advances Kinaeto's dialogue (it waits for you)
- **← / → arrow keys** (or a horizontal swipe across the centre of the view on touch
  screens) toggle fixed side views: the camera stands at one cave wall facing the other,
  lighting up the cult's carved slogans. The same key — or Esc — returns to centre
- Opposing units that meet on a tile square off on its edges instead of overlapping

## Deployment

GitHub Pages serves the repository root **from the `main` branch** ("Deploy from a
branch" mode; `.nojekyll` skips Jekyll processing). Every push to `main` redeploys.
`.github/workflows/deploy.yml` is a leftover from the Actions-based deploy mode — it is
unused (and will show failed runs) while Pages is in branch mode; delete it or switch the
Pages source to GitHub Actions if preferred.

## Project layout

```
index.html          shell, import map, HUD DOM
style.css           boxless glowing HUD / overlay styling, runic font face
vendor/             vendored three.module.min.js (r160) + Uncial Antiqua woff2
src/config.js       board layout, RULES (all balance knobs), camera poses, palette
src/data.js         cards (stats/keywords/cries), enemies, waves, Kinaeto's dialogue
src/battle.js       turn engine — pure logic, no three.js, emits animation events
src/scene.js        renderer, camera rig (glance/side/focus), cave, obelisk, walls
src/board.js        the 3 × 7 tile paths, highlights, gaze tint, warning sigils
src/units.js        procedural unit meshes (cloaked cult / knights), HP bars, intents
src/kinaeto.js      the hand-with-an-eye, emerge/retreat/blink
src/cards3d.js      the hand of cards as 3D objects (canvas faces, springs, tilt)
src/effects.js      tween manager, floating combat text
src/hud.js          DOM HUD: impetus flames, kinaetic eye, gaze line, dialogue, screens
src/main.js         input modes, event animation/batching, stack formations, game flow
tests/engine.test.mjs  engine test suite — run with `node tests/engine.test.mjs`
```

## Development notes (for picking the project back up)

**Workflow.** Development happens on `claude/roguelike-deck-telekinesis-pb1ftb`; `main`
is kept in sync (same commits) because Pages deploys from it. Push to both. There is no
build step and no node_modules — the repo runs as-is from any static server.

**Architecture.** `src/battle.js` is a pure state machine: every mutating call returns an
ordered list of typed events (documented at the top of the file), and `src/main.js`
consumes them sequentially — events sharing a `batch` tag animate as one overlapping
brawl. All balance lives in `RULES` (`src/config.js`) and the card/enemy defs
(`src/data.js`); camera framing lives in `CAMERA_POSES`.

**Testing.** `node tests/engine.test.mjs` runs the 30-check engine suite (stacks,
clashes, breakthrough, burn, gaze, intents, cries, rites). For interaction testing the
page exposes `window.__game` (battle, mode, board, cardHand, unitViews, world, plus
`_test` helpers) — Playwright scripts drive real drags by projecting mesh positions
through `world.camera` to screen coordinates. Dialogue advances only on click/Space, so
automated runs must click `#dialogue` (dispatch via JS — its hit-target moves).

**Turn resolution order** (in `battle.endTurn`): sign casts → clashes on contested tiles
(cult strikes first, arrival order, front unit tanks) → unengaged fists advance →
unengaged enemies act (boss ability / volley / siege / advance) → wave spawns & warnings
→ gaze rotates → next turn (impetus resets to 4, draw 3, stuns clear).

**Known watchpoints** (deliberately left for playtesting):
- Clashes made offense strong; waves may need tuning up (counts or stats) in
  `BATTLE_ONE` (`src/data.js`).
- Stack front is "first to arrive" — there is no way to rotate a fresh Warden to the
  front of an existing stack yet. A Kinaetic reorder is the natural next mechanic.
- The gaze can pick the same path twice in a row (`nextGazePath` is uniform random).
- Enemy sign-types don't exist yet; enemy `armor` is the only crusader keyword.

## Roadmap (post-prototype)

- A run map between battles (roguelike node choices), card rewards and deck editing
- More battles, followers, relics, and boss abilities
- Stack reordering via telekinesis; more rites (Levitate a tile, Seismic Clap, Offering)
- Sound, and richer telekinesis feedback (grab-and-drag with the ghostly hand)
