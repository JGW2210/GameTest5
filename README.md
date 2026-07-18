# KINAETO — Beneath the Flame

A roguelike deck-builder prototype built with [Three.js](https://threejs.org/). You are the
leader of a cult sheltering in a torch-lit cave, backed by **Kinaeto** — a benevolent
Lovecraftian god who manifests as a great hand with an eye in its palm, reaching through a
portal above the obelisk that ties him to the material plane. A feudal church has declared
your god evil and marched a crusade on your gate.

## Game flow

```
menu → THE FIRST NIGHT (guided tutorial, scripted loss) → the dream → THE SANCTUM (hub)
                                                                          ⇅
                                                            battle one: The Lower Gate
```

**The First Night** opens on the sanctum — the cult's established ceremony grounds
(stone-flagged floors, hanging lanterns, a grand pillared altar around a larger obelisk).
Kinaeto is mid-sermon to a pre-placed congregation facing him when crusaders crash the
ceremony. A locked, step-by-step lesson then teaches every mechanic in order: intents,
placement, burning for Impetus, ending the turn, telekinesis, rites, the gaze (via the
immovable Eye), and the Beckoning — each step gates input to the taught action, with
Kinaeto narrating. At the end of turn 5 the fight ends the only way it can: **Grand
Inquisitor Sarethiel** arrives, his Judgement stuns every faithful soul at once, and the
obelisk shatters (animated — the spire bursts into scattering shards and the portal
collapses). Kinaeto then visits the player in a dream and asks them to begin again and
raise a new obelisk to re-establish his link to the material plane.

**The Sanctum (hub)** is the between-battles cave, with three clickable stations:

- **The Altar of Names** — the deck manager. Toggle which owned cards march (deck of
  15–25 from the collection).
- **The Cold Forge** — the smith. Three free upgrade "embers" for now (+1 ⚔ or +1 ♥ to
  every copy of a troop card); a real economy arrives with later passes.
- **The Severed Link** — Kinaeto. He confirms you are ready and opens the war map, which
  currently shows a single stage (The Lower Gate); deeper nodes are drawn but locked.

Hub state (deck, collection, forgings, story progress) persists in `localStorage`
(`kinaeto-meta-v1`).

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
index.html          shell, import map, HUD DOM (+ hub panels, dream, flash)
style.css           boxless glowing HUD / overlay styling, runic font face, hub panels
vendor/             vendored three.module.min.js (r160) + Uncial Antiqua woff2
src/config.js       board layout, RULES (all balance knobs), camera poses, palette, themes
src/data.js         cards, enemies (incl. the Inquisitor), waves, tutorial battle, dialogue
src/battle.js       turn engine — pure logic, no three.js, emits animation events;
                    injectable deck/cards, placePreset, spawnWaveNow, doom()
src/scene.js        renderer + camera rig, and the swappable stages:
                    'cave' (battle one), 'sanctum' (tutorial), 'hub' — plus shatterObelisk()
src/board.js        the 3 × 7 tile paths, highlights, gaze tint, sigils, per-stage themes
src/units.js        procedural unit meshes (cloaked cult / knights / the Inquisitor)
src/kinaeto.js      the hand-with-an-eye, emerge/retreat/blink
src/cards3d.js      the hand of cards as 3D objects; setCardSource() for forged card faces
src/effects.js      tween manager, floating combat text
src/hud.js          DOM HUD: flames, kinaetic eye, dialogue, dream overlay, screens
src/meta.js         persistent hub state: collection, deck (15–25), forge charges, progress
src/tutorial.js     the First Night controller: sermon, input gates, guided steps, the doom
src/hub.js          hub stations (raycast) + DOM panels: deck manager, smith, war map
src/main.js         game-flow states (menu/tutorial/hub/battle), input modes, event animation
tests/engine.test.mjs  engine test suite — run with `node tests/engine.test.mjs`
```

## Development notes (for picking the project back up)

**Workflow.** This pass was developed on `claude/kinaeto-tutorial-hub-f19xvv`. Pages
deploys from `main`, so merging there redeploys. There is no build step and no
node_modules — the repo runs as-is from any static server.

**Architecture.** `src/battle.js` is a pure state machine: every mutating call returns an
ordered list of typed events (documented at the top of the file), and `src/main.js`
consumes them sequentially — events sharing a `batch` tag animate as one overlapping
brawl. All balance lives in `RULES` (`src/config.js`) and the card/enemy defs
(`src/data.js`); camera framing lives in `CAMERA_POSES`. New in this pass:

- `Battle` takes `opts` — `deck` (key list), `cards` (a card table; the smith's
  `effectiveCards(meta)` output), `noShuffle` (the tutorial draws in listed order).
- `World.setStage('cave'|'sanctum'|'hub')` tears down and rebuilds the environment
  group; `world.stations` (hub) are raycastable; `world.shatterObelisk(tweens)` plays
  the obelisk's death.
- `src/tutorial.js` gates input per step (`gate`/`noteAction`/`afterEvents`) — main's
  input handlers consult it, and `validPlacementCells` filters highlights through it.
- The scripted loss is engine-real: `battle.doom()` stuns all cultists, zeroes the
  obelisk, and emits `doomStun`/`obeliskShatter`/`lose` events the view animates.
- The telekinesis facing bug is fixed in `animateMove` (`src/main.js`): the carried
  unit takes one full spin that lands exactly on `userData.baseFacing`, instead of the
  old per-frame `rotation.y += 0.06` that left units facing a random direction.

**Testing.** `node tests/engine.test.mjs` runs the 41-check engine suite (stacks,
clashes, breakthrough, burn, gaze, intents, cries, rites, injectable decks, tutorial
scripting/doom). For interaction testing the page exposes `window.__game` (battle, mode,
state, tutorial, hub, meta, board, cardHand, unitViews, world, plus `_test` helpers) —
Playwright scripts drive real drags by projecting mesh positions through `world.camera`
to screen coordinates. Dialogue advances only on click/Space, so automated runs must
click `#dialogue` / `#dream` (dispatch via JS — hit-targets move). Headless SwiftShader
renders this scene at a crawl; for automation set `__game.timeScale` (multiplies
animation dt), `world.rigEnabled = false` (freezes the glance/side camera so projected
clicks stay true), disable `renderer.shadowMap`, and drop `setPixelRatio(0.4)`. The full
tutorial → dream → hub → battle-one flow has been driven end-to-end this way with real
pointer input.

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
- The tutorial's guided steps assume the fixed `TUTORIAL_DECK` order — if the deck or
  step order changes, re-check that each taught card is in hand when its step arrives.
- The hub economy is a placeholder: forge upgrades are free (3 charges), the map has
  one node, and there are no card rewards yet. `meta.js` is where currency lands.

## Roadmap (post-prototype)

- Real hub economy: Offerings earned per battle, forge costs, shop stock, card rewards
- More map nodes (roguelike route choices) and battles; the shops "improve as the
  battles commence" per the design intent
- More followers, relics, and boss abilities; stack reordering via telekinesis; more
  rites (Levitate a tile, Seismic Clap, Offering)
- Sound, and richer telekinesis feedback (grab-and-drag with the ghostly hand)
