// ===== CHIMPBOY =====

const canvas = document.getElementById('chimpboy-canvas');
const ctx    = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// ── SPRITE SHEET ─────────────────────────────────────────────
// 128×128 sheet, 8 cols × 8 rows, each frame 16×16
// Row order (8-directional clockwise from south):
//   0:S  1:SW  2:W  3:NW  4:N  5:NE  6:E  7:SE
const FRAME_W  = 16, FRAME_H = 16;

// Load sprite then color-key the background out
let spriteCanvas = null;

const rawSprite = new Image();
rawSprite.src = 'images/chimpboy-sprite.png';
rawSprite.onload = () => {
  const oc   = document.createElement('canvas');
  oc.width   = rawSprite.naturalWidth;
  oc.height  = rawSprite.naturalHeight;
  const octx = oc.getContext('2d');
  octx.drawImage(rawSprite, 0, 0);

  const imgData = octx.getImageData(0, 0, oc.width, oc.height);
  const d       = imgData.data;

  // Sample top-left pixel as the key colour
  const kr = d[0], kg = d[1], kb = d[2];

  for (let i = 0; i < d.length; i += 4) {
    if (
      Math.abs(d[i]   - kr) < 32 &&
      Math.abs(d[i+1] - kg) < 32 &&
      Math.abs(d[i+2] - kb) < 32
    ) {
      d[i+3] = 0; // make transparent
    }
  }
  octx.putImageData(imgData, 0, 0);
  spriteCanvas = oc;
};
const DIR      = { s:0, sw:1, w:2, nw:3, n:4, ne:5, e:6, se:7 };
const FRAMES   = 4;   // walk frames per direction (cols 0–3)
const FRAME_MS = 130; // ms per animation frame

// ── SCREEN AREA (on canvas) ───────────────────────────────────
// Shell drawn at 60×75, scaled 4× → 240×300
// Screen hole at (12,11,36,28) on small canvas = (48,44,144,112) on main
const SCREEN = { x: 48, y: 44, w: 144, h: 112 };

// ── GAME WORLD ────────────────────────────────────────────────
const TILE = 16;
const COLS = 9;  // 144 / 16
const ROWS = 7;  // 112 / 16
const SPEED = 1.4;

// 0 = floor, 1 = wall, 2 = desk (solid, drawn specially)
const tilemap = [
  [1,1,1,1,1,1,1,1,1],
  [1,0,0,2,2,2,2,0,1],
  [1,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1],
];

// ── PLAYER ────────────────────────────────────────────────────
const player = {
  x:      4 * TILE,   // pixel pos in game world
  y:      3 * TILE,
  dir:    DIR.s,
  frame:  0,
  moving: false,
};

// ── INPUT ─────────────────────────────────────────────────────
const keys = {};
document.addEventListener('keydown', e => {
  const tag = document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (['w','a','s','d'].includes(k)) e.preventDefault();
});
document.addEventListener('keyup', e => {
  const tag = document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  keys[e.key.toLowerCase()] = false;
});

// ── TIMING ────────────────────────────────────────────────────
let frameTimer = 0;
let lastTime   = performance.now();

// ── PALETTE ───────────────────────────────────────────────────
// Classic GB green screen
const GB = { c0:'#9bbc0f', c1:'#8bac0f', c2:'#306230', c3:'#0f380f' };

// DMG shell — cream/beige pixel art style
const S = {
  body    : '#dbd3c0',   // main cream
  bodyDk  : '#b8b0a2',   // darker top strip
  bodySh  : '#c4bcaa',   // left edge shadow
  bodyHi  : '#ece6d8',   // right highlight
  bezel   : '#6e8e80',   // teal screen bezel outer
  bezelIn : '#4a6e62',   // bezel inner darker ring
  dpad    : '#1e2830',   // d-pad dark
  dpadHi  : '#2e3c48',   // d-pad center pip
  carrier : '#8aa88a',   // A/B oval carrier
  btnAB   : '#cc5072',   // button pink
  btnABDk : '#9a3050',   // button shadow
  slash   : '#6a6870',   // start/select marks
  led     : '#ff1a1a',   // red power LED
  accR    : '#cc3344',   // red accent stripe
  accB    : '#4466bb',   // blue accent stripe
  cart    : '#8a8278',   // cartridge lines
};

// ── PIXEL ART HELPERS ─────────────────────────────────────────
// Draw a blocky "circle" via two overlapping rects (pixel art style)
function pxCircle(c, cx, cy, r, col) {
  c.fillStyle = col;
  c.fillRect(cx - r + 1, cy - r,     (r - 1) * 2, r * 2);
  c.fillRect(cx - r,     cy - r + 1, r * 2,       (r - 1) * 2);
}

// Build and cache the shell once — drawn at 55×90, blitted 4× onto main canvas
let shellCache = null;

function buildShell() {
  // 60×75 small canvas, blitted 4× → 240×300
  // Front face occupies x:3–52, y:2–67 (50×65)
  // Right side face: x:53–56, y:5–70  (3px depth, offset 3px down)
  // Bottom face:     x:6–56, y:68–71  (3px depth, offset 3px right)
  const sc = document.createElement('canvas');
  sc.width  = 60;
  sc.height = 75;
  const s   = sc.getContext('2d');
  s.imageSmoothingEnabled = false;

  // ── RIGHT SIDE FACE (drawn first so front face sits on top) ──
  // 2px deep, offset 2px down for 45° perspective feel
  s.fillStyle = S.bodySh;
  s.fillRect(53, 4, 3, 62);
  // single-pixel diagonal at top-right corner
  s.fillRect(53, 3, 1, 1);

  // ── BOTTOM FACE ──
  // 2px deep, offset 2px right
  s.fillStyle = S.bodyDk;
  s.fillRect(5, 68, 51, 2);
  // single-pixel diagonal at bottom-left corner
  s.fillRect(4, 68, 1, 1);
  // bottom-right corner where both faces meet
  s.fillRect(53, 68, 3, 2);

  // ── FRONT FACE ──
  s.fillStyle = S.body;
  s.fillRect(3, 2, 50, 66);

  // Left shadow strip (1px)
  s.fillStyle = S.bodySh;
  s.fillRect(3, 2, 1, 66);

  // Right edge highlight on front face
  s.fillStyle = S.bodyHi;
  s.fillRect(51, 2, 1, 48);

  // Bottom-right white corner sticker highlight
  s.fillStyle = '#ffffff';
  s.globalAlpha = 0.4;
  s.fillRect(41, 57, 11, 9);
  s.globalAlpha = 1;

  // ── Top cartridge strip ──
  s.fillStyle = S.bodyDk;
  s.fillRect(3, 2, 50, 7);
  // Three notch slots
  s.fillStyle = S.cart;
  [22, 27, 32].forEach(x => s.fillRect(x, 3, 2, 5));

  // ── Screen bezel outer ──
  s.fillStyle = S.bezel;
  s.fillRect(9, 9, 42, 32);
  // Bezel inner darker ring
  s.fillStyle = S.bezelIn;
  s.fillRect(10, 10, 40, 30);
  // Accent stripes
  s.fillStyle = S.accR;
  s.fillRect(12, 10, 13, 1);
  s.fillStyle = S.accB;
  s.fillRect(35, 10, 13, 1);
  // Dark screen surround
  s.fillStyle = '#111a14';
  s.fillRect(11, 11, 38, 28);
  // Screen hole: (12,11,36,28) × 4 = (48,44,144,112) = SCREEN ✓
  s.fillStyle = GB.c3;
  s.fillRect(12, 11, 36, 28);

  // ── LED ──
  s.fillStyle = S.led;
  s.fillRect(5, 17, 2, 2);

  // ── D-pad ──
  s.fillStyle = S.dpad;
  s.fillRect(11, 52, 12, 4);   // H bar
  s.fillRect(15, 48, 4,  12);  // V bar
  s.fillStyle = S.dpadHi;
  s.fillRect(15, 52, 4, 4);    // centre pip
  s.fillStyle = S.dpad;
  s.fillRect(11, 53, 1, 2);    // arm tips
  s.fillRect(22, 53, 1, 2);
  s.fillRect(16, 48, 2, 1);
  s.fillRect(16, 59, 2, 1);

  // ── A/B carrier ──
  s.fillStyle = S.carrier;
  s.fillRect(37, 49, 12, 2);
  s.fillRect(36, 51, 14, 8);
  s.fillRect(37, 59, 12, 2);
  // A button
  pxCircle(s, 44, 51, 3, S.btnABDk);
  pxCircle(s, 44, 50, 3, S.btnAB);
  // B button
  pxCircle(s, 38, 58, 3, S.btnABDk);
  pxCircle(s, 38, 57, 3, S.btnAB);

  // ── Start / Select slashes ──
  s.fillStyle = S.slash;
  s.fillRect(22, 63, 5, 2);
  s.fillRect(29, 62, 5, 2);

  // ── Speaker slots ──
  s.fillStyle = S.bodySh;
  [51, 54, 57, 60, 63].forEach(y => s.fillRect(46, y, 4, 1));

  // ── Cartridge connector slots — thin 1px lines on bottom face ──
  s.fillStyle = S.cart;
  [8, 13, 18, 23, 28, 33, 38, 43].forEach(x => s.fillRect(x, 68, 2, 1));

  shellCache = sc;
}

// ── DRAW SHELL (blit cached low-res shell at 4×) ──────────────
function drawShell() {
  if (!shellCache) buildShell();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(shellCache, 0, 0, 240, 300);
}

// ── DRAW ROOM ─────────────────────────────────────────────────
function drawRoom() {
  ctx.save();
  ctx.translate(SCREEN.x, SCREEN.y);

  // Tiles
  for (let row=0; row<ROWS; row++) {
    for (let col=0; col<COLS; col++) {
      const tile = tilemap[row][col];
      const tx = col*TILE, ty = row*TILE;

      if (tile === 1) {
        // Wall — dark block with inner bevel
        ctx.fillStyle = GB.c3;
        ctx.fillRect(tx, ty, TILE, TILE);
        ctx.fillStyle = GB.c2;
        ctx.fillRect(tx+1, ty+1, TILE-2, TILE-2);
        ctx.fillStyle = GB.c3;
        ctx.fillRect(tx+3, ty+3, TILE-6, TILE-6);
      } else if (tile === 0) {
        // Floor — subtle checkerboard
        ctx.fillStyle = (row+col)%2===0 ? GB.c0 : GB.c1;
        ctx.fillRect(tx, ty, TILE, TILE);
        // floor grid lines
        ctx.fillStyle = GB.c2;
        ctx.fillRect(tx, ty, TILE, 1);
        ctx.fillRect(tx, ty, 1, TILE);
      } else if (tile === 2) {
        // Desk surface (top face)
        ctx.fillStyle = GB.c2;
        ctx.fillRect(tx, ty, TILE, TILE);
        // surface highlight stripe
        ctx.fillStyle = GB.c1;
        ctx.fillRect(tx+1, ty+3, TILE-2, 3);
        // front edge shadow
        ctx.fillStyle = GB.c3;
        ctx.fillRect(tx, ty+TILE-3, TILE, 3);
      }
    }
  }

  // Desk legs (below desk row, in row 2)
  ctx.fillStyle = GB.c3;
  ctx.fillRect(3*TILE+4,  2*TILE,   3, 9);
  ctx.fillRect(6*TILE+9,  2*TILE,   3, 9);

  // ── Pixel art monitor on desk ──
  drawMonitor();

  ctx.restore();
}

function drawMonitor() {
  // Position: centred on desk tiles 4–5, row 1
  // These coords are relative to SCREEN origin (already translated)
  const mx = 4*TILE, my = TILE - 14;

  // Monitor outer casing
  ctx.fillStyle = GB.c3;
  ctx.fillRect(mx+1, my,    28, 19);

  // Screen glass
  ctx.fillStyle = GB.c0;
  ctx.fillRect(mx+3, my+2,  22, 13);

  // Screen content — tiny "code" lines
  ctx.fillStyle = GB.c2;
  [4,7,10].forEach(ly => ctx.fillRect(mx+4, my+ly, 12+(ly%6), 1));

  // Reflection
  ctx.fillStyle = GB.c1;
  ctx.fillRect(mx+4, my+3, 7, 1);

  // Stand neck
  ctx.fillStyle = GB.c3;
  ctx.fillRect(mx+12, my+19, 5, 4);

  // Stand base
  ctx.fillRect(mx+8,  my+22, 13, 2);
}

// ── COLLISION ─────────────────────────────────────────────────
function isSolid(px, py) {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) return true;
  return tilemap[ty][tx] !== 0;
}

function canMove(nx, ny) {
  const m = 2, sz = TILE - 4;
  return !isSolid(nx+m, ny+m)  && !isSolid(nx+sz, ny+m) &&
         !isSolid(nx+m, ny+sz) && !isSolid(nx+sz, ny+sz);
}

// ── DRAW PLAYER ───────────────────────────────────────────────
function drawPlayer() {
  if (!spriteCanvas) return;
  ctx.save();
  ctx.translate(SCREEN.x, SCREEN.y);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    spriteCanvas,
    player.frame * FRAME_W,   // source X (column)
    player.dir   * FRAME_H,   // source Y (row)
    FRAME_W, FRAME_H,
    player.x, player.y,
    FRAME_W, FRAME_H
  );
  ctx.restore();
}

// ── GAME LOOP ─────────────────────────────────────────────────
function loop(now) {
  const dt = Math.min(now - lastTime, 50);
  lastTime     = now;
  frameTimer  += dt;

  // Input → direction
  let dx = 0, dy = 0;
  if (keys['w']) dy = -1;
  if (keys['s']) dy =  1;
  if (keys['a']) dx = -1;
  if (keys['d']) dx =  1;

  if (dx !== 0 || dy !== 0) {
    // Pick direction row
    if      (dx===0  && dy===-1) player.dir = DIR.n;
    else if (dx===0  && dy=== 1) player.dir = DIR.s;
    else if (dx===-1 && dy=== 0) player.dir = DIR.w;
    else if (dx=== 1 && dy=== 0) player.dir = DIR.e;
    else if (dx===-1 && dy===-1) player.dir = DIR.nw;
    else if (dx=== 1 && dy===-1) player.dir = DIR.ne;
    else if (dx===-1 && dy=== 1) player.dir = DIR.sw;
    else if (dx=== 1 && dy=== 1) player.dir = DIR.se;

    // Normalise diagonal speed
    if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }
  }

  player.moving = dx !== 0 || dy !== 0;

  // Move + collide (X and Y independently so you slide along walls)
  const nx = player.x + dx * SPEED;
  const ny = player.y + dy * SPEED;
  if (canMove(nx, player.y)) player.x = nx;
  if (canMove(player.x, ny)) player.y = ny;

  // Walk animation
  if (player.moving && frameTimer >= FRAME_MS) {
    player.frame = (player.frame + 1) % FRAMES;
    frameTimer   = 0;
  }
  if (!player.moving) player.frame = 0;

  // ── RENDER ──
  ctx.clearRect(0, 0, 240, 300);
  drawShell();
  drawRoom();
  drawPlayer();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
