# Week 6 Example 2 — Free Roam Top-Down with Boss Battle

## What This Example Demonstrates

<<<<<<< HEAD
> **Note for students:** This section is included in example files only to help you study. Do not include it in your Side Quest submissions.


=======
>>>>>>> 61485c2d006cfac2f3c58fed95142e9dc225a132
- **Free roam world** — the world is 1600×2000px; the player moves in world coordinates and is constrained to world boundaries with `constrain()`
- **Smooth-follow camera** — `camX` and `camY` track the top-left of the visible area; `lerp()` moves the camera smoothly toward the player each frame; `translate(-camX, -camY)` shifts all world drawing into screen coordinates
- **`push()` / `pop()` around translate** — everything inside draws in world coordinates; HUD and minimap are drawn after `pop()` in screen coordinates so they stay fixed on screen
- **`loadJSON()`** — loads `data/enemies.json` in `preload()`; wave trigger positions, enemy speeds, and boss data all stored in one file
- **Position-based wave triggers** — each wave has a `spawnAt` world Y value; `checkWaveSpawns()` compares `player.y` against each threshold; when the player moves above it the wave spawns
- **Boss zone** — a glowing area at the top of the world; entering it calls `spawnBoss()` which builds the boss object from JSON data and switches to `STATE_BOSS`
- **Boss state machine** — cycles through `"pausing"`, `"charging"`, `"retreating"`; charges at the player, overshoots, retreats to the top centre, pauses, repeats
- **Minimap** — drawn in screen coordinates after `pop()`; uses `map()` to convert world positions to minimap positions; shows player (teal), enemies (orange), boss (red), and a camera viewport rectangle
- **Two `lerpColor()` bars** — player health shifts green→red; boss health shifts orange→red
- **Sound hooks** — all sound calls are commented out; hooks for shoot, hit, player hit, boss hit, boss music transition, and win
- **B key** — skips directly to the boss fight for testing; calls `spawnBoss()` and moves the player into the boss zone

## Setup and Interaction Instructions

To run the sketch locally, open `index.html` in Google Chrome using Live Server.

**Controls:**
- Move: WASD
- Shoot: Spacebar (shoots in the direction you last moved)
- B: Skip to boss fight (testing only)
- Restart: R (after win or game over)

Explore the world, survive enemy waves as you move north, then enter the glowing boss zone to fight the giant orange blob. Watch the minimap to track enemies off screen.

**Adding Your Own Sounds**
1. Add your sound files to `assets/sounds/`
2. In `preload()`, uncomment the `loadSound()` lines and update the file paths
3. Uncomment the `play()` or `loop()` calls in the relevant functions — there are hooks for the boss music transition too

**Editing the Waves and Boss**
Open `data/enemies.json` to change when waves spawn, how many enemies appear, their speed, and the boss stats. Each wave has a `spawnAt` world Y value — lower values trigger later since the player starts at the bottom of the world.

**Opening the Chrome Console**
- **Windows:** Press `F12` or `Ctrl + Shift + J`, then click the **Console** tab
- **Mac:** Press `Cmd + Option + J`

## Assets

No external assets used. All visuals are generated with p5.js.

## References

N/A
