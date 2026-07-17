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

You start with **5 cards** and draw **5 more each turn** (hand cap of 10 — undrawn cards
wait in the deck), spending **Kinaetic energy** to place followers:

| Type | Behaviour |
| --- | --- |
| ✋ **Open Palm** (defensive) | Holds its tile. Only your telekinesis moves it. |
| ✊ **Closed Fist** (attacker) | Advances at end of turn — unless an enemy shares its tile, then it attacks. |
| 🖐 **Hand Sign** (magic) | Casts 2–5 tiles along its path. Can **never** be moved, even by telekinesis — it would sever its connection to Kinaeto. |
| ⛰ **Relic** (object) | Inert obstacle that blocks the path. Telekinesis can hurl it anywhere. |

Base units may be placed on the first two tiles of your half (or in the obelisk room);
**fast** units may also be placed on the third tile. Only telekinesis can put a unit deeper.

### Telekinesis

Once per turn, Kinaeto reaches through you — pick one power from the right-hand panel,
then a target (yours *or* theirs):

- **Move** — lift any unit one tile in any direction
- **Push** — hurl a unit two tiles along its path (including your own units into the enemy half)
- **Crush** — clench: 3 damage
- **Trip** — sweep the legs: the unit skips its next action

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
- **Telekinesis panel** (right): pick a power, click a target unit, then a destination tile
- **Right-click / Esc** cancels; **End Turn** resolves the round
- **Camera glance**: move the cursor to the bottom of the screen to peek at the path
  mouths (and incoming-wave sigils) above your hand; move it to the top to frame the
  full obelisk. During dialogue the camera pans up to Kinaeto himself
- **Click or Space** advances Kinaeto's dialogue (it waits for you)

## Deployment

`.github/workflows/deploy.yml` publishes the repository root to GitHub Pages on every push
to `main`. One-time setup: in the repo settings, under **Pages**, set the source to
**GitHub Actions**.

## Project layout

```
index.html          shell, import map, HUD DOM
style.css           HUD / overlay styling
vendor/             vendored three.module.min.js (r160)
src/config.js       board layout, rules, palette
src/data.js         cards, enemies, waves, Kinaeto's dialogue
src/battle.js       turn engine (pure logic, emits animation events)
src/scene.js        renderer, camera, cave, torches, obelisk, portal, embers
src/board.js        the 3 × 7 tile paths, highlights, warning sigils
src/units.js        procedural low-poly unit meshes + HP bars
src/kinaeto.js      the hand-with-an-eye, emerge/retreat/blink
src/cards3d.js      the hand of cards as 3D objects (canvas-textured)
src/effects.js      tween manager, floating combat text
src/hud.js          DOM HUD: energy, obelisk, telekinesis, dialogue, screens
src/main.js         input modes, event animation, game flow
```

## Roadmap (post-prototype)

- A run map between battles (roguelike node choices), card rewards and deck editing
- More battles, followers, relics, and boss abilities
- Sound, and richer telekinesis feedback (grab-and-drag with the ghostly hand)
