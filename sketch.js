// ============================================================
// Week 6 Example 2 — Free Roam Top-Down with Boss Battle
// ============================================================
// The player moves freely around a world larger than the canvas.
// A smooth-follow camera keeps the player centred.
// Enemy waves are loaded from JSON and chase the player.
// A minimap in the bottom-right corner shows the player and
// enemy positions at all times.
// A giant orange blob boss spawns when the player enters the
// boss zone at the top of the world. Defeat it to win.
// Press B to skip straight to the boss for testing.
//
// Files:
//   sketch.js           — all game logic
//   data/enemies.json   — wave trigger positions, enemy data, boss data
//   data/obstacles.json — obstacle positions in world coordinates
// ============================================================

// ------------------------------------------------------------
// CAMERA
// camX and camY are the world coordinates at the top-left
// of the canvas. translate(-camX, -camY) shifts everything
// so the player appears centred on screen.
// ------------------------------------------------------------
let camX = 0;
let camY = 0;
const CAM_SMOOTHING = 0.5;
let camZoom = 0.7;

// ------------------------------------------------------------
// PLAYER CONFIGURATION
// ------------------------------------------------------------
const PLAYER_SPEED = 15;
let moveSpeed = PLAYER_SPEED;
const INVINCIBLE_FRAMES = 90; // ADDED — was referenced but never defined

// ------------------------------------------------------------
// PLAYER
// Position is in world coordinates.
// Starts near the bottom centre of the world.
// ------------------------------------------------------------
let player = {
  x: 15000,
  y: 3000,
  r: 22,
  blobT: 0,
  direction: { x: 0, y: -1 },
  shootTimer: 0,
  health: 5,
  maxHealth: 5,
  invincible: false,
  invincibleTimer: 0,
  bounceVX: 0,
  bounceVY: 0,
};

// ------------------------------------------------------------
// BULLETS and ENEMIES
// Positions are in world coordinates.
// ------------------------------------------------------------
let bullets = [];
let enemies = [];

// ------------------------------------------------------------
// OBSTACLES
// Loaded from data/obstacles.json in preload().
// Positioned in world coordinates — drawn and collided in
// world space. Player takes damage and bounces on contact.
// ------------------------------------------------------------
let obstacleData;
let obstacles = [];

let tileData;
let tiles = [];

let waterTiles = [];

let fishArea;

// ------------------------------------------------------------
// ADDED — TILE PHYSICS
// Tiles are grouped by *behaviour* rather than by raw id, since
// the same id number means different things on different layers.
// Add/rename layer names here to match your map.json exactly.
// ------------------------------------------------------------
const SOLID_LAYERS = ["rock", "seaweed"]; // blocks movement CHANGE SEAWEED PROPERTES
const HAZARD_LAYERS = ["spikes"]; // kills on contact
const CHECKPOINT_LAYER = "checkpoint"; // respawn points
const COLLECTABLE_LAYER = "coins";
const WHIRLPOOL_LAYER = "whirlpool";
// "water" and "bg green" (and anything else) are treated as pure
// background — they're drawn but never checked for collision.

let solidTiles = []; // [{x,y,w,h}] world-space rects — rock + seaweed
let hazardTiles = []; // [{x,y,w,h}] world-space rects — spikes
let checkpoints = []; // [{x,y,w,h,spawnX,spawnY}] grouped checkpoint zones, sorted left→right
let activeCheckpointIndex = -1; // index into `checkpoints` of the furthest one reached
let lastCheckpoint = null; // {x,y} world coords the player respawns at
let playerStart = { x: 0, y: 0 }; // fallback spawn if no checkpoint reached yet
let coinMap = new Map(); // key: "tx,ty" -> collected boolean
let coinsTotal = 0;
let coinsCollected = 0;
let whirlpoolTiles = []; // [{x,y,w,h}]
let allCoinsCollected = false;

// ------------------------------------------------------------
// WAVE SYSTEM
// Each wave has a triggerY — spawns when player.y < triggerY.
// nextWave tracks which wave to check next.
// ------------------------------------------------------------
let enemyData;
let nextWave = 0;

// ------------------------------------------------------------
// BOSS
// Spawns when player enters the boss zone (player.y < bossZoneY).
// ------------------------------------------------------------
let boss = null;
let bossData = null;
const BOSS_ZONE_Y = 300; // world Y — enter this zone to trigger boss

// ------------------------------------------------------------
// MINIMAP
// Drawn in screen coordinates after pop().
// Shows a scaled-down version of the world with dots for
// the player (teal) and enemies (orange).
// ------------------------------------------------------------
const MAP_W = 120; // minimap width in pixels
const MAP_H = 120; // minimap height in pixels
const MAP_X = 16; // screen position — bottom left
const MAP_Y_OFFSET = 16; // offset from bottom of screen

// ------------------------------------------------------------
// GAME STATE
// ------------------------------------------------------------
let score = 0;

const STATE_PLAY = "play";
const STATE_BOSS = "boss";
const STATE_WIN = "win";
const STATE_OVER = "over";
let gameState = STATE_PLAY;

// ------------------------------------------------------------
// SOUNDS — uncomment and fill in paths to add audio
// ------------------------------------------------------------
// let shootSound;
// let hitSound;
// let playerHitSound;
// let bossHitSound;
// let bossMusic;
// let winSound;
// let music;

// ============================================================
// preload()
// ============================================================
function preload() {
  enemyData = loadJSON("data/enemies.json");
  obstacleData = loadJSON("data/obstacles.json");
  tileData = loadJSON("data/map.json");
  fishArea = loadJSON("data/fisharea.json");

  // Uncomment to load sounds:
  // shootSound     = loadSound("assets/sounds/shoot.wav");
  // hitSound       = loadSound("assets/sounds/hit.wav");
  // playerHitSound = loadSound("assets/sounds/playerhit.wav");
  // bossHitSound   = loadSound("assets/sounds/bosshit.wav");
  // bossMusic      = loadSound("assets/sounds/bossmusic.mp3");
  // winSound       = loadSound("assets/sounds/win.wav");
  // music          = loadSound("assets/sounds/music.mp3");
}

const TILE_SIZE = 50;

// ============================================================
// setup()
// ============================================================
function setup() {
  createCanvas(800, 450);
  WORLD_W = TILE_SIZE * (tileData.mapWidth + fishArea.mapWidth); // total world width in pixels
  WORLD_H = TILE_SIZE * (tileData.mapHeight + fishArea.mapHeight); // total world height in pixels
  bossData = enemyData.boss;
  console.log("tileData=", tileData);
  console.log("obstacleData=", obstacleData);

  // Build obstacle objects from JSON
  for (let i = 0; i < obstacleData.obstacles.length; i++) {
    let o = obstacleData.obstacles[i];
    obstacles.push({ x: o.x, y: o.y, size: o.size });
  }

  const tilesArray = tileData.layers?.[0]?.tiles || [];
  for (let i = 0; i < tilesArray.length; i++) {
    const t = tilesArray[i];
    tiles.push({ x: t.x, y: t.y, id: t.id });
  }

  // ADDED — sort solid/hazard/checkpoint tiles out of every layer
  // and group checkpoint tiles into discrete zones.
  buildTileCollision();

  // ADDED — remember the player's starting point as the fallback
  // respawn location for before any checkpoint has been reached.
  playerStart = { x: player.x, y: player.y };

  // Start camera so player is visible
  camX = player.x - width / 2;
  camY = player.y - height / 2;

  // Uncomment to start music:
  // music.loop();
}

// ============================================================
// draw()
// ============================================================
function draw() {
  background(20);
  console.log(player.x / 50, player.y / 50); // for troubleshooting

  updateCamera();
  updateInvincibility(); // ADDED — ticks down player.invincibleTimer

  // Everything inside push/pop is drawn in world coordinates
  push();
  translate(width / 2, height / 2);
  scale(camZoom); // translate to centre and scale the world translate
  translate(-width / 2, -height / 2); // then translate the world by camera top-left in world pixels
  translate(-camX, -camY);

  drawBackground();

  // if player is near y lvel of fish area
  if (player.y > TILE_SIZE * (tileData.mapHeight - tileData.mapHeight / 7)) {
    // add end of fish area boundary later
    drawTiles(fishArea); // fish area
    console.log("fish area drawn");
  }

  if (gameState === STATE_PLAY) {
    updateMoveSpeed();
    handleInput();
    applyBounce();

    // ADDED — tile physics: solid blockage, hazards, checkpoints
    resolveSolidCollisions();
    checkWhirlpools();
    checkCollectables();
    checkHazardCollisions();
    checkCheckpoints();
    checkObstaclePlayerCollision(); // was defined but never called

    drawObstacles();
    drawTiles(tileData);

    drawPlayer();
  }

  pop(); // restore screen coordinates

  drawMinimap();
}
// ------------------------------------------------------------
// updateCamera()
// Smoothly moves the camera toward the player each frame.
// Clamps so the camera never shows outside the world.
// ------------------------------------------------------------
function updateCamera() {
  let visibleW = width / camZoom;
  let visibleH = height / camZoom;

  let targetX = player.x - width / 2;
  let targetY = player.y - height / 2;

  targetX = constrain(targetX, 0, WORLD_W - width);
  targetY = constrain(targetY, 0, WORLD_H - height);

  camX = lerp(camX, targetX, CAM_SMOOTHING);
  camY = lerp(camY, targetY, CAM_SMOOTHING);
}

// ------------------------------------------------------------
// ADDED — updateInvincibility()
// Counts down the player's invincibility window after taking a
// hit (from spikes or obstacles) and clears the flag at zero.
// If you already decrement invincibleTimer somewhere else in your
// full project, remove this function to avoid double-counting.
// ------------------------------------------------------------
function updateInvincibility() {
  if (player.invincible) {
    player.invincibleTimer--;
    if (player.invincibleTimer <= 0) {
      player.invincible = false;
      player.invincibleTimer = 0;
    }
  }
}

// ============================================================
// ADDED — TILE PHYSICS
// ============================================================

// ------------------------------------------------------------
// processJsonLayers()
// Helper function to extract and categorize tiles from a JSON
// file's layers. Can be called for tileData, fishArea, or any
// other future JSON files to build a unified collision system.
// Applies world offsets so fishArea tiles are positioned correctly.
// ------------------------------------------------------------
function processJsonLayers(
  jsonFile,
  checkpointTiles,
  coinTiles,
  offsetX = 0,
  offsetY = 0,
) {
  if (!jsonFile || !jsonFile.layers) return;

  for (const layer of jsonFile.layers) {
    const isWater = layer.name === "water";
    const isSolid = SOLID_LAYERS.includes(layer.name);
    const isHazard = HAZARD_LAYERS.includes(layer.name);
    const isCheckpoint = layer.name === CHECKPOINT_LAYER;
    const isCoin = layer.name === COLLECTABLE_LAYER;
    const isWhirlpool = layer.name === WHIRLPOOL_LAYER;

    if (
      !isSolid &&
      !isHazard &&
      !isCheckpoint &&
      !isCoin &&
      !isWhirlpool &&
      !isWater
    )
      continue;

    for (const t of layer.tiles) {
      const rect = {
        x: t.x * TILE_SIZE + offsetX,
        y: t.y * TILE_SIZE + offsetY,
        w: TILE_SIZE,
        h: TILE_SIZE,
        tx: t.x,
        ty: t.y,
      };
      if (isSolid) solidTiles.push(rect);
      else if (isHazard) hazardTiles.push(rect);
      else if (isCheckpoint) checkpointTiles.push(rect);
      else if (isCoin) coinTiles.push(rect);
      else if (isWhirlpool) whirlpoolTiles.push(rect);
      else if (isWater) waterTiles.push(rect);
    }
  }
}

// ============================================================
// ADDED — TILE PHYSICS
// ============================================================

// ------------------------------------------------------------
// buildTileCollision()
// Walks every layer in tileData once, sorting tiles into
// solidTiles / hazardTiles / raw checkpoint tiles based on the
// layer's name. Called once from setup(). Call it again if you
// ever swap tileData for a different scene/map at runtime.
// ------------------------------------------------------------
function buildTileCollision() {
  solidTiles = [];
  hazardTiles = [];
  const checkpointTiles = [];
  const coinTiles = [];
  whirlpoolTiles = [];
  waterTiles = [];

  // Process layers from tileData (no offset)
  processJsonLayers(tileData, checkpointTiles, coinTiles, 0, 0);

  // Process layers from fishArea with world offsets
  const fishAreaOffsetX = TILE_SIZE * (tileData.mapWidth - 33);
  const fishAreaOffsetY = TILE_SIZE * tileData.mapHeight;
  processJsonLayers(
    fishArea,
    checkpointTiles,
    coinTiles,
    fishAreaOffsetX,
    fishAreaOffsetY,
  );

  function playerInWater() {
    for (const t of waterTiles) {
      const closestX = constrain(player.x, t.x, t.x + t.w);
      const closestY = constrain(player.y, t.y, t.y + t.h);

      if (dist(player.x, player.y, closestX, closestY) < player.r) {
        return true;
      }
    }
    return false;
  }

  checkpoints = groupCheckpointTiles(checkpointTiles);
  // register coins
  coinMap = new Map();
  coinsTotal = coinTiles.length;
  coinsCollected = 0;
  for (const c of coinTiles) {
    const k = c.tx + "," + c.ty;
    coinMap.set(k, false);
  }
}

// ------------------------------------------------------------
// groupCheckpointTiles()
// Checkpoint tiles are usually placed as a small cluster (a
// flag/banner a few tiles wide). This flood-fills adjacent
// checkpoint tiles into a single zone so touching ANY tile in
// the cluster counts as reaching that checkpoint, and gives each
// zone one spawn point (top-centre of the cluster).
// ------------------------------------------------------------
function groupCheckpointTiles(tileRects) {
  const key = (tx, ty) => tx + "," + ty;
  const lookup = new Map();
  for (const r of tileRects) lookup.set(key(r.tx, r.ty), r);

  const visited = new Set();
  const groups = [];

  for (const start of tileRects) {
    const startKey = key(start.tx, start.ty);
    if (visited.has(startKey)) continue;

    const queue = [start];
    visited.add(startKey);
    const cluster = [];

    while (queue.length) {
      const cur = queue.shift();
      cluster.push(cur);

      const neighbours = [
        [cur.tx + 1, cur.ty],
        [cur.tx - 1, cur.ty],
        [cur.tx, cur.ty + 1],
        [cur.tx, cur.ty - 1],
      ];
      for (const [nx, ny] of neighbours) {
        const nk = key(nx, ny);
        if (lookup.has(nk) && !visited.has(nk)) {
          visited.add(nk);
          queue.push(lookup.get(nk));
        }
      }
    }

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const c of cluster) {
      minX = Math.min(minX, c.x);
      minY = Math.min(minY, c.y);
      maxX = Math.max(maxX, c.x + c.w);
      maxY = Math.max(maxY, c.y + c.h);
    }

    groups.push({
      x: minX,
      y: minY,
      w: maxX - minX,
      h: maxY - minY,
      spawnX: (minX + maxX) / 2,
      spawnY: minY - player.r - 4, // spawn just above the checkpoint tiles
    });
  }

  // Left-to-right order so "furthest checkpoint reached" is just an index.
  groups.sort((a, b) => a.x - b.x);
  return groups;
}

// ------------------------------------------------------------
// resolveSolidCollisions()
// Pushes the player out of any overlapping rock/seaweed tile.
// Run AFTER handleInput()/applyBounce() so movement this frame
// has already been applied, then corrected.
// ------------------------------------------------------------
function resolveSolidCollisions() {
  for (const t of solidTiles) {
    resolveCircleRect(player, t);
  }
}

// ------------------------------------------------------------
// resolveCircleRect()
// Circle (player) vs axis-aligned rect (tile) overlap + push-out.
// Mutates p.x / p.y directly so the player can never end up
// inside a solid tile.
// ------------------------------------------------------------
function resolveCircleRect(p, rect) {
  const closestX = constrain(p.x, rect.x, rect.x + rect.w);
  const closestY = constrain(p.y, rect.y, rect.y + rect.h);

  const dx = p.x - closestX;
  const dy = p.y - closestY;
  const distSq = dx * dx + dy * dy;

  if (distSq >= p.r * p.r) return; // not overlapping

  const d = Math.sqrt(distSq);

  if (d > 0) {
    // push out along the line from the rect's closest edge point to the player centre
    const overlap = p.r - d;
    p.x += (dx / d) * overlap;
    p.y += (dy / d) * overlap;
  } else {
    // player centre is exactly on/inside the rect — push out the shortest way
    const left = p.x - rect.x;
    const right = rect.x + rect.w - p.x;
    const top = p.y - rect.y;
    const bottom = rect.y + rect.h - p.y;
    const min = Math.min(left, right, top, bottom);

    if (min === left) p.x = rect.x - p.r;
    else if (min === right) p.x = rect.x + rect.w + p.r;
    else if (min === top) p.y = rect.y - p.r;
    else p.y = rect.y + rect.h + p.r;
  }
}

// ------------------------------------------------------------
// checkHazardCollisions()
// Spikes kill on contact — same circle-vs-rect overlap test as
// the solid tiles, but on touch it kills/respawns instead of
// pushing the player out.
// ------------------------------------------------------------
function checkHazardCollisions() {
  if (player.invincible) return;

  for (const t of hazardTiles) {
    const closestX = constrain(player.x, t.x, t.x + t.w);
    const closestY = constrain(player.y, t.y, t.y + t.h);
    const d = dist(player.x, player.y, closestX, closestY);

    if (d < player.r) {
      // Respawn the player at the nearest checkpoint (no life loss)
      respawnFromHazard();
      break;
    }
  }
}

// ------------------------------------------------------------
// checkCheckpoints()
// Activates the furthest checkpoint the player has touched.
// activeCheckpointIndex only ever moves forward, so walking back
// over an earlier checkpoint doesn't undo your progress.
// ------------------------------------------------------------
function checkCheckpoints() {
  for (let i = activeCheckpointIndex + 1; i < checkpoints.length; i++) {
    const cp = checkpoints[i];

    const overlapsX =
      player.x + player.r > cp.x && player.x - player.r < cp.x + cp.w;
    const overlapsY =
      player.y + player.r > cp.y && player.y - player.r < cp.y + cp.h;

    if (overlapsX && overlapsY) {
      activeCheckpointIndex = i;
      lastCheckpoint = { x: cp.spawnX, y: cp.spawnY };
      // Hook a sound/flash/UI message here if you'd like to
      // celebrate reaching a checkpoint, e.g.:
      // checkpointSound.play();
    }
  }
}

// ------------------------------------------------------------
// killPlayer()
// Shared death handler for spikes (and reusable for enemies/boss
// attacks later). Loses a life, then either ends the game or
// respawns at the last checkpoint.
// ------------------------------------------------------------
function killPlayer() {
  player.health--;
  // playerHitSound.play();

  if (player.health <= 0) {
    gameState = STATE_OVER;
    // music.stop();
    return;
  }

  respawnPlayer();
}

// ------------------------------------------------------------
// respawnPlayer()
// Moves the player to the last checkpoint reached, or back to
// the original start position if none has been reached yet.
// Grants a short invincibility window so they don't immediately
// die again on the same hazard.
// ------------------------------------------------------------
function respawnPlayer() {
  const spawn =
    lastCheckpoint ||
    findClosestPassedCheckpoint(player.x, player.y) ||
    playerStart;

  player.x = spawn.x;
  player.y = spawn.y;
  player.bounceVX = 0;
  player.bounceVY = 0;
  player.invincible = true;
  player.invincibleTimer = INVINCIBLE_FRAMES;

  camX = constrain(player.x - width / 2, 0, WORLD_W - width);
  camY = constrain(player.y - height / 2, 0, WORLD_H - height);
}

// ------------------------------------------------------------
// findClosestPassedCheckpoint()
// Returns the nearest spawn point among checkpoints the player
// has already reached, or null if none have been reached.
// ------------------------------------------------------------
function findClosestPassedCheckpoint(px, py) {
  if (activeCheckpointIndex < 0) return null;

  let best = null;
  let minD = Infinity;
  for (let i = 0; i <= activeCheckpointIndex && i < checkpoints.length; i++) {
    const cp = checkpoints[i];
    const d = dist(px, py, cp.spawnX, cp.spawnY);
    if (d < minD) {
      minD = d;
      best = {
        x: cp.spawnX,
        y: cp.spawnY,
      };
    }
  }

  return best;
}

// ------------------------------------------------------------
// findClosestCheckpoint()
// Returns the spawn {x,y} of the nearest checkpoint zone, or
// the original playerStart if none exist.
// ------------------------------------------------------------
function findClosestCheckpoint(px, py) {
  let best = playerStart;
  let minD = dist(px, py, playerStart.x, playerStart.y);

  for (const cp of checkpoints) {
    const d = dist(px, py, cp.spawnX, cp.spawnY);
    if (d < minD) {
      minD = d;
      best = {
        x: cp.spawnX,
        y: cp.spawnY,
      };
    }
  }

  return best;
}

// ------------------------------------------------------------
// respawnFromHazard()
// Immediate respawn used for spike contacts: does NOT reduce
// player health and does NOT grant invincibility (no flicker).
// Respawns at the nearest passed checkpoint or start.
// ------------------------------------------------------------
function respawnFromHazard() {
  const spawn =
    findClosestPassedCheckpoint(player.x, player.y) ||
    lastCheckpoint ||
    playerStart;

  player.x = spawn.x;
  player.y = spawn.y;
  player.bounceVX = 0;
  player.bounceVY = 0;
  // no invincibility here — user requested no glitching/flicker

  camX = constrain(player.x - width / 2, 0, WORLD_W - width);
  camY = constrain(player.y - height / 2, 0, WORLD_H - height);
}

// ------------------------------------------------------------
// checkCollectables()
// Detects overlap with coin tiles and marks them collected.
// When all coins are collected sets `allCoinsCollected`.
// ------------------------------------------------------------
function checkCollectables() {
  if (coinsTotal === 0 || allCoinsCollected) return;

  for (const layer of tileData.layers) {
    if (layer.name !== COLLECTABLE_LAYER) continue;
    for (const t of layer.tiles) {
      const key = t.x + "," + t.y;
      if (coinMap.get(key)) continue; // already collected

      const cx = t.x * TILE_SIZE + TILE_SIZE / 2;
      const cy = t.y * TILE_SIZE + TILE_SIZE / 2;
      const d = dist(player.x, player.y, cx, cy);
      if (d < player.r + TILE_SIZE * 0.35) {
        coinMap.set(key, true);
        coinsCollected++;
        if (coinsCollected >= coinsTotal) {
          allCoinsCollected = true;
          // hook: unlock door / advance level
          console.log("All coins collected!");
        }
      }
    }
  }
}

// ------------------------------------------------------------
// checkWhirlpools()
// Applies a pulling force toward any whirlpool tile the player
// is near. If the player gets too close they are pulled in.
// ------------------------------------------------------------
function checkWhirlpools() {
  if (!whirlpoolTiles || whirlpoolTiles.length === 0) return;

  for (const t of whirlpoolTiles) {
    const cx = t.x + t.w / 2;
    const cy = t.y + t.h / 2;
    const dx = cx - player.x;
    const dy = cy - player.y;
    const d = Math.sqrt(dx * dx + dy * dy);

    const influence = t.w * 2; // radius of effect
    if (d < influence && d > 0.1) {
      // pull strength increases as you get closer
      const pull = map(d, influence, 0, 0.4, 3.0);
      player.x += (dx / d) * pull;
      player.y += (dy / d) * pull;
    }

    // Optional: if the player is extremely close, respawn them
    if (d < 6) {
      respawnFromHazard();
      break;
    }
  }
}

function updateMoveSpeed() {
  moveSpeed = playerInWater() ? 4 : PLAYER_SPEED;
}

function playerInWater() {
  for (const t of waterTiles) {
    const closestX = constrain(player.x, t.x, t.x + t.w);
    const closestY = constrain(player.y, t.y, t.y + t.h);
    if (dist(player.x, player.y, closestX, closestY) < player.r) {
      return true;
    }
  }
  return false;
}

function drawTiles(jsonFile) {
  const layers = jsonFile.layers;
  for (let l = layers.length - 1; l > -1; l--) {
    // for each layer we will....
    const layer = layers[l];
    for (let i = 0; i < layer.tiles.length; i++) {
      let t = layer.tiles[i];

      push();

      // drawing map

      let mapXOffset = 0; // where the json is in relation to 0,0
      let mapYOffset = 0;

      if (jsonFile == fishArea) {
        mapXOffset = TILE_SIZE * (tileData.mapWidth - 33);
        mapYOffset = TILE_SIZE * tileData.mapHeight;
      }

      let x = t.x * TILE_SIZE + mapXOffset;
      let y = t.y * TILE_SIZE + mapYOffset;

      // If this is a coin tile and it has been collected, skip drawing it
      if (layer.name === COLLECTABLE_LAYER) {
        const key = t.x + "," + t.y;
        if (coinMap.get(key)) {
          pop();
          continue;
        }
      }

      // CHANGED — colour now keys off the layer name first (since the
      // same id number means different things on different layers),
      // falling back to the old id-based colours for anything else.
      fill(tileColor(layer.name, t.id));
      if (layer.name === COLLECTABLE_LAYER) {
        // draw coin as a circle centered in the tile
        ellipse(x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE * 0.6);
      } else if (layer.name === WHIRLPOOL_LAYER) {
        // draw whirlpool as a rounded rect with darker centre
        rect(x, y, TILE_SIZE, TILE_SIZE, TILE_SIZE * 0.25);
        fill(10, 50, 120, 160);
        ellipse(x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE * 0.6);
      } else {
        rect(x, y, TILE_SIZE, TILE_SIZE);
      }

      if (jsonFile == fishArea) {
        mapXOffset = TILE_SIZE * (tileData.mapWidth - 33);
        mapYOffset = TILE_SIZE * tileData.mapHeight;
      }

      // push();

      rect(x, y, TILE_SIZE, TILE_SIZE);

      // pop();

      pop();
    }
  }
}

// ------------------------------------------------------------
// ADDED — tileColor()
// Centralises tile colour lookup by layer name. Swap any of
// these for image()/sprite drawing later without touching the
// physics code above.
// ------------------------------------------------------------
function tileColor(layerName, id) {
  switch (layerName) {
    case "spikes":
      return color(200, 40, 40); // red — danger
    case "checkpoint":
      return color(255, 215, 0); // gold — flag
    case "rock":
      return color(90, 90, 90); // grey — solid
    case "seaweed":
      return color(40, 140, 60); // green — solid
    case "coins":
      return color(255, 215, 0); // gold coin
    case "whirlpool":
      return color(30, 100, 200); // blue whirlpool
    case "water":
      return color(20, 60, 160, 160); // blue — background
    case "bg green":
      return color(140, 200, 140, 160); // pale green — background
  }

  // fallback: old id-based colours, for any layer name not listed above
  switch (id) {
    case "0":
      return color("gray");
    case "1":
      return color("lightblue");
    case "2":
      return color("purple");
    case "3":
      return color("orange");
    case "4":
      return color("yellow");
    case "5":
      return color(0);
    case "6":
      return color(0, 0, 200);
    case "7":
      return color("blue");
    case "8":
      return color(80, 80, 100);
    case "9":
      return color(200, 240, 255);
    case "10":
      return color("pink");
    default:
      return color("green");
  }
}

// ------------------------------------------------------------
// drawObstacles()
// Drawn in world coordinates inside push/pop.
// Only draws obstacles near the camera for performance.
// ------------------------------------------------------------
function drawObstacles() {
  for (let i = 0; i < obstacles.length; i++) {
    let o = obstacles[i];

    // Skip if off screen
    if (
      o.x + o.size < camX ||
      o.x - o.size > camX + width ||
      o.y + o.size < camY ||
      o.y - o.size > camY + height
    )
      continue;

    let x = o.x - o.size / 2;
    let y = o.y - o.size / 2;
    let s = o.size;

    push();

    pop();
  }
}

// ------------------------------------------------------------
// checkObstaclePlayerCollision()
// Circle-rectangle overlap test — same as Example 1.
// Obstacle contact is no longer harmful; obstacles are treated
// like a reward/interaction point instead of a death hazard.
// ------------------------------------------------------------
function checkObstaclePlayerCollision() {
  for (let i = 0; i < obstacles.length; i++) {
    let o = obstacles[i];

    let closestX = constrain(player.x, o.x - o.size / 2, o.x + o.size / 2);
    let closestY = constrain(player.y, o.y - o.size / 2, o.y + o.size / 2);
    let d = dist(player.x, player.y, closestX, closestY);

    if (d < player.r) {
      // Keep a small bounce off obstacles for feedback,
      // but do not reduce health or end the game.
      let dx = player.x - o.x;
      let dy = player.y - o.y;
      let len = dist(0, 0, dx, dy);
      if (len > 0) {
        player.bounceVX = (dx / len) * 8;
        player.bounceVY = (dy / len) * 8;
      }
      break;
    }
  }
}

// ------------------------------------------------------------
// applyBounce()
// Applies and decays bounce velocity each frame.
// ------------------------------------------------------------
function applyBounce() {
  if (abs(player.bounceVX) > 0.1 || abs(player.bounceVY) > 0.1) {
    player.x += player.bounceVX;
    player.y += player.bounceVY;
    player.bounceVX *= 0.75;
    player.bounceVY *= 0.75;

    player.x = constrain(player.x, player.r, WORLD_W - player.r);
    player.y = constrain(player.y, player.r, WORLD_H - player.r);
  }
}

// ------------------------------------------------------------
// drawBackground()
// Draws background shapes in world coordinates.
// ------------------------------------------------------------
function drawBackground() {
  noStroke();

  // World boundary outline
  noFill();
  stroke(60, 50, 80);
  strokeWeight(4);
  rect(0, 0, WORLD_W, WORLD_H);
  noStroke();
}

// ------------------------------------------------------------
// handleInput()
// WASD moves the player in world coordinates.
// Constrained to world boundaries.
// Spacebar fires in the current facing direction.
// ------------------------------------------------------------
function handleInput() {
  if (keyIsDown(87)) {
    player.y -= moveSpeed;
    player.direction = { x: 0, y: -1 };
  }
  if (keyIsDown(83)) {
    player.y += moveSpeed;
    player.direction = { x: 0, y: 1 };
  }
  if (keyIsDown(65)) {
    player.x -= moveSpeed;
    player.direction = { x: -1, y: 0 };
  }
  if (keyIsDown(68)) {
    player.x += moveSpeed;
    player.direction = { x: 1, y: 0 };
  }

  // Keep player inside world bounds
  player.x = constrain(player.x, player.r, WORLD_W - player.r);
  player.y = constrain(player.y, player.r, WORLD_H - player.r);
}

// ------------------------------------------------------------
// updateBullets()
// Bullets travel in world coordinates.
// Removed when they leave the world bounds.
// ------------------------------------------------------------
function updateBullets() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    bullets[i].x += bullets[i].vx;
    bullets[i].y += bullets[i].vy;

    if (
      bullets[i].x < 0 ||
      bullets[i].x > WORLD_W ||
      bullets[i].y < 0 ||
      bullets[i].y > WORLD_H
    ) {
      bullets.splice(i, 1);
    }
  }
}

// ------------------------------------------------------------
// drawPlayer()
// Drawn in world coordinates. Flickers while invincible.
// ------------------------------------------------------------
function drawPlayer() {
  if (player.invincible && floor(player.invincibleTimer / 6) % 2 === 0) return;

  push();
  fill(0, 200, 180);
  noStroke();

  beginShape();
  let numPoints = 48;
  for (let i = 0; i < numPoints; i++) {
    let angle = (TWO_PI / numPoints) * i;
    let noiseVal = noise(
      cos(angle) * 0.8 + player.blobT,
      sin(angle) * 0.8 + player.blobT,
    );
    let r = player.r + map(noiseVal, 0, 1, -6, 6);
    vertex(player.x + cos(angle) * r, player.y + sin(angle) * r);
  }
  endShape(CLOSE);

  fill(10);
  ellipse(player.x - 7, player.y - 5, 7, 7);
  ellipse(player.x + 7, player.y - 5, 7, 7);

  pop();
  player.blobT += 0.015;
}

// ------------------------------------------------------------
// drawMinimap()
// Drawn in screen coordinates after pop().
// Shows a scaled-down view of the world with:
//   Teal dot  — player position
//   Orange dots — enemy positions
//   Red dot   — boss position (when active)
//   Orange zone — boss zone indicator at top of minimap
// ------------------------------------------------------------
function drawMinimap() {
  let mapX = MAP_X;
  let mapY = height - MAP_H - MAP_Y_OFFSET;

  // Background
  fill(0, 0, 0, 180);
  stroke(80, 60, 120);
  strokeWeight(1);
  rect(mapX, mapY, MAP_W, MAP_H, 4);
  noStroke();

  // Helper — converts world position to minimap screen position
  function worldToMap(wx, wy) {
    return {
      x: mapX + map(wx, 0, WORLD_W, 0, MAP_W),
      y: mapY + map(wy, 0, WORLD_H, 0, MAP_H),
    };
  }

  // Player dot — drawn last so it's always on top
  fill(0, 200, 180);
  let pp = worldToMap(player.x, player.y);
  ellipse(pp.x, pp.y, 7);

  // Camera viewport rectangle — shows what's currently visible
  noFill();
  stroke(255, 255, 255, 60);
  strokeWeight(1);
  let vp = worldToMap(camX, camY);
  let vpW = map(width, 0, WORLD_W, 0, MAP_W);
  let vpH = map(height, 0, WORLD_H, 0, MAP_H);
  rect(vp.x, vp.y, vpW, vpH);
  noStroke();

  // Label
  fill(120);
  textSize(9);
  textAlign(LEFT);
  textFont("monospace");
  text("MAP", mapX + 4, mapY + MAP_H - 4);
}

// ------------------------------------------------------------
// keyPressed()
// R restarts. B skips to boss fight.
// ------------------------------------------------------------
function keyPressed() {
  // B — skip to boss fight for testing
  if (key === "b" || key === "B") {
    player.y = BOSS_ZONE_Y - 10;
    if (!boss) spawnBoss();
  }

  // music.loop();
}
