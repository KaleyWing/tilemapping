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

let WORLD_W; // total world width in pixels
let WORLD_H; // total world height in pixels

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

// ------------------------------------------------------------
// PLAYER
// Position is in world coordinates.
// Starts near the bottom centre of the world.
// ------------------------------------------------------------
let player = {
  x: 1,
  y: 1,
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

// ------------------------------------------------------------
// WAVE SYSTEM
// Each wave has a triggerY — spawns when player.y < triggerY.
// nextWave tracks which wave to check next.
// ------------------------------------------------------------
let enemyData;
let nextWave = 0;

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

  // Uncomment to load sounds:
  // shootSound     = loadSound("assets/sounds/shoot.wav");
  // hitSound       = loadSound("assets/sounds/hit.wav");
  // playerHitSound = loadSound("assets/sounds/playerhit.wav");
  // bossHitSound   = loadSound("assets/sounds/bosshit.wav");
  // bossMusic      = loadSound("assets/sounds/bossmusic.mp3");
  // winSound       = loadSound("assets/sounds/win.wav");
  // music          = loadSound("assets/sounds/music.mp3");
}

// ------------------------------------------------------------
// WORLD
// The world is larger than the canvas. The camera follows
// the player so only part of the world is visible at once.
// ------------------------------------------------------------
const TILE_SIZE = 50;

// ============================================================
// setup()
// ============================================================
function setup() {
  createCanvas(800, 450);
  WORLD_W = TILE_SIZE * tileData.mapWidth; // total world width in pixels
  WORLD_H = TILE_SIZE * tileData.mapHeight; // total world height in pixels

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

  updateCamera();

  // Everything inside push/pop is drawn in world coordinates
  push();
  translate(width / 2, height / 2);
  scale(camZoom); // translate to centre and scale the world translate
  translate(-width / 2, -height / 2); // then translate the world by camera top-left in world pixels
  translate(-camX, -camY);

  drawBackground();

  if (gameState === STATE_PLAY) {
    handleInput();
    applyBounce();

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

function drawTiles(jsonFile) {
  const layers = jsonFile.layers; 
  for (let l = layers.length - 1; l > -1; l--) {
    // for each layer
    for (let i = 0; i < layers[l].tiles.length; i++) {
      let t = layers[l].tiles[i];

      if (
        // skip if offscreen
        t.x + t.size < camX ||
        t.x - t.size > camX + width ||
        t.y + t.size < camY ||
        t.y - t.size > camY + height
      )
        continue;

      push();

      let x = t.x * TILE_SIZE;
      let y = t.y * TILE_SIZE;
      if (t.id === "0") {
        fill("gray"); // spike 1
      } else if (t.id === "1") {
        fill("light blue"); // spike 2
      } else if (t.id === "2") {
        fill("purple"); // spike 3
      } else if (t.id === "3") {
        // for the real json file
        fill("orange"); // spike 4
      } else if (t.id === "4") {
        // key
        fill("yellow");
      } else if (t.id === "5") {
        fill(0); // rock
      } else if (t.id === "6") {
        fill(0, 0, 200); // water
      } else if (t.id === "7") {
        fill("blue"); // water top
      } else if (t.id === "8") {
        fill(80, 80, 100); // cave bg
      } else if (t.id === "9") {
        fill(200, 240, 255); //background sky
      } else if (t.id === "10") {
        fill("pink");
      } else {
        fill("green");
      }
      rect(x, y, TILE_SIZE, TILE_SIZE);

      pop();
    }
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

    // Animated glow — pulses using sin(frameCount)
    let glow = map(sin(frameCount * 0.05 + i * 1.2), -1, 1, 40, 90);

    push()
  }
}

// ------------------------------------------------------------
// checkObstaclePlayerCollision()
// Circle-rectangle overlap test — same as Example 1.
// Player bounces away and loses health on contact.
// ------------------------------------------------------------
function checkObstaclePlayerCollision() {
  if (player.invincible) return;

  for (let i = 0; i < obstacles.length; i++) {
    let o = obstacles[i];

    let closestX = constrain(player.x, o.x - o.size / 2, o.x + o.size / 2);
    let closestY = constrain(player.y, o.y - o.size / 2, o.y + o.size / 2);
    let d = dist(player.x, player.y, closestX, closestY);

    if (d < player.r) {
      player.health--;
      player.invincible = true;
      player.invincibleTimer = INVINCIBLE_FRAMES;

      // Bounce direction — away from obstacle centre
      let dx = player.x - o.x;
      let dy = player.y - o.y;
      let len = dist(0, 0, dx, dy);
      if (len > 0) {
        player.bounceVX = (dx / len) * 8;
        player.bounceVY = (dy / len) * 8;
      }

      // playerHitSound.play();

      if (player.health <= 0) {
        gameState = STATE_OVER;
        // music.stop();
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
    player.y -= PLAYER_SPEED;
    player.direction = { x: 0, y: -1 };
  }
  if (keyIsDown(83)) {
    player.y += PLAYER_SPEED;
    player.direction = { x: 0, y: 1 };
  }
  if (keyIsDown(65)) {
    player.x -= PLAYER_SPEED;
    player.direction = { x: -1, y: 0 };
  }
  if (keyIsDown(68)) {
    player.x += PLAYER_SPEED;
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

  // R — restart
  if (
    (key === "r" || key === "R") &&
    gameState !== STATE_PLAY &&
    gameState !== STATE_BOSS
  ) {
    gameState = STATE_PLAY;
    score = 0;
    nextWave = 0;
    bullets = [];
    enemies = [];
    boss = null;

    player.x = WORLD_W / 2;
    player.y = WORLD_H - 200;
    player.direction = { x: 0, y: -1 };
    player.shootTimer = 0;
    player.health = player.maxHealth;
    player.invincible = false;
    player.invincibleTimer = 0;
    player.bounceVX = 0;
    player.bounceVY = 0;

    camX = player.x - width / 2;
    camY = player.y - height / 2;

    // music.loop();
  }
}
