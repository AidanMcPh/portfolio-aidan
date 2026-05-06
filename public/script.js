// ===== INTRO SCREEN =====
(function () {
  const introScreen = document.getElementById('intro-screen');
  const hotspot     = document.getElementById('computer-hotspot');
  const canvas      = document.getElementById('monitor-canvas');
  const video       = document.getElementById('monitor-video');
  const wrapper     = document.getElementById('intro-wrapper');
  const ctx         = canvas.getContext('2d');

  // Pixel resolution of the canvas — lower = chunkier pixels
  const PX_W = 80, PX_H = 50;
  canvas.width  = PX_W;
  canvas.height = PX_H;
  canvas.style.width  = PX_W + 'px';
  canvas.style.height = PX_H + 'px';

  // Draw the Links window on top of the video
  function drawLinksWindow() {
    const x = 24, y = 13, w = 25, h = 18;

    // Window body
    ctx.fillStyle = 'rgba(10, 10, 22, 0.88)';
    ctx.fillRect(x, y, w, h);

    // Title bar
    ctx.fillStyle = 'rgba(8, 8, 18, 0.95)';
    ctx.fillRect(x, y, w, 5);

    // Traffic lights
    ctx.fillStyle = '#ff5f57'; ctx.fillRect(x+1, y+1, 1, 1);
    ctx.fillStyle = '#ffbd2e'; ctx.fillRect(x+3, y+1, 1, 1);
    ctx.fillStyle = '#28ca41'; ctx.fillRect(x+5, y+1, 1, 1);

    // Title
    ctx.fillStyle = '#ccc';
    ctx.font = '3px serif';
    ctx.textAlign = 'center';
    ctx.fillText('Links', x + w / 2, y + 4);

    // Separator
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(x, y + 5, w, 1);

    // GitHub icon
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + 5, y + 10, 2, 0, Math.PI * 2);
    ctx.fill();

    // GitHub label
    ctx.fillStyle = '#ddd';
    ctx.font = '3px serif';
    ctx.textAlign = 'left';
    ctx.fillText('AidanMcPh', x + 9, y + 11);

    // Separator
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(x, y + 13, w, 1);

    // LinkedIn icon
    ctx.fillStyle = '#0A66C2';
    ctx.fillRect(x + 3, y + 15, 4, 4);

    // LinkedIn label
    ctx.fillStyle = '#ddd';
    ctx.font = '3px serif';
    ctx.fillText('linkedin', x + 9, y + 18);

    // Window border
    ctx.strokeStyle = 'rgba(200,200,200,0.65)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  }

  // Draw video + Links window every frame
  function drawFrame() {
    if (!video.paused && !video.ended) {
      ctx.drawImage(video, 0, 0, PX_W, PX_H);
    }
    drawLinksWindow();
    requestAnimationFrame(drawFrame);
  }
  video.addEventListener('play', drawFrame);
  video.play().catch(() => {});

  // Monitor screen quad corners [x%, y%] — TL, TR, BR, BL
  const QUAD = [
    [70.6, 21  ],
    [97.9,  6  ],
    [87.1, 89  ],
    [66.4, 73.9],
  ];

  // ── Projective transform: rectangle → arbitrary quad via CSS matrix3d ──
  function adj(m) {
    return [
      m[4]*m[8]-m[5]*m[7], m[2]*m[7]-m[1]*m[8], m[1]*m[5]-m[2]*m[4],
      m[5]*m[6]-m[3]*m[8], m[0]*m[8]-m[2]*m[6], m[2]*m[3]-m[0]*m[5],
      m[3]*m[7]-m[4]*m[6], m[1]*m[6]-m[0]*m[7], m[0]*m[4]-m[1]*m[3],
    ];
  }
  function mmul(a, b) {
    const c = Array(9).fill(0);
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++)
        for (let k = 0; k < 3; k++) c[3*i+j] += a[3*i+k] * b[3*k+j];
    return c;
  }
  function mvec(m, v) {
    return [m[0]*v[0]+m[1]*v[1]+m[2]*v[2],
            m[3]*v[0]+m[4]*v[1]+m[5]*v[2],
            m[6]*v[0]+m[7]*v[1]+m[8]*v[2]];
  }
  function basis(x1,y1,x2,y2,x3,y3,x4,y4) {
    const m = [x1,x2,x3, y1,y2,y3, 1,1,1];
    const v = mvec(adj(m), [x4,y4,1]);
    return mmul(m, [v[0],0,0, 0,v[1],0, 0,0,v[2]]);
  }
  function projectiveMatrix(w, h, tl, tr, br, bl) {
    const s = basis(0,0, w,0, w,h, 0,h);
    const d = basis(tl[0],tl[1], tr[0],tr[1], br[0],br[1], bl[0],bl[1]);
    const t = mmul(d, adj(s));
    for (let i = 0; i < 9; i++) t[i] /= t[8];
    return [t[0],t[3],0,t[6], t[1],t[4],0,t[7], 0,0,1,0, t[2],t[5],0,t[8]];
  }

  function positionCanvas() {
    const ww = wrapper.offsetWidth, wh = wrapper.offsetHeight;
    const pts = QUAD.map(([px,py]) => [ww*px/100, wh*py/100]);
    const m = projectiveMatrix(PX_W, PX_H, pts[0], pts[1], pts[2], pts[3]);
    canvas.style.transform = `matrix3d(${m.join(',')})`;
  }

  positionCanvas();
  window.addEventListener('resize', positionCanvas);

  // Click → zoom into monitor + depixelate → reveal portfolio
  hotspot.addEventListener('click', () => {
    if (typeof audioCtx !== 'undefined' && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    // Get monitor bounding box in viewport pixels
    const wr   = wrapper.getBoundingClientRect();
    const pts  = QUAD.map(([px, py]) => [wr.left + wr.width * px / 100, wr.top + wr.height * py / 100]);
    const xs   = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const monL = Math.min(...xs), monR = Math.max(...xs);
    const monT = Math.min(...ys), monB = Math.max(...ys);

    const vw = window.innerWidth, vh = window.innerHeight;
    const monCx = (monL + monR) / 2, monCy = (monT + monB) / 2;
    const monW  = monR - monL,       monH  = monB - monT;
    const ZOOM_MS  = 600;   // how long the zoom-in lasts
    const FLASH_MS = 120;   // white flash duration
    const startTime = performance.now();

    // Point the GIF zoom toward the monitor center
    introScreen.style.transformOrigin =
      `${(monCx / vw * 100).toFixed(1)}% ${(monCy / vh * 100).toFixed(1)}%`;

    // White flash overlay
    const flash = document.createElement('div');
    flash.style.cssText = 'position:fixed;inset:0;z-index:10000;background:#fff;opacity:0;pointer-events:none;';
    document.body.appendChild(flash);

    function ease(t) { return t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t; }

    function step(now) {
      const elapsed = now - startTime;

      if (elapsed < ZOOM_MS) {
        // Phase 1: gentle zoom in
        const t = ease(elapsed / ZOOM_MS);
        introScreen.style.transform = `scale(${1 + 0.08 * t})`;
        requestAnimationFrame(step);

      } else if (elapsed < ZOOM_MS + FLASH_MS) {
        // Phase 2: white flash — ramp up then hold
        const t = (elapsed - ZOOM_MS) / FLASH_MS;
        flash.style.opacity = t < 0.5 ? t * 2 : 1;
        requestAnimationFrame(step);

      } else {
        // Phase 3: hide intro, reveal website
        introScreen.style.display        = 'none';
        introScreen.style.transform      = '';
        introScreen.style.transformOrigin = '';
        flash.remove();
      }
    }

    requestAnimationFrame(step);
  });
})();

// ===== SHARED WINDOW STATE =====
// Velocity lives here so both drag and jellyfish detector can access it
const winState = {};

function getState(id) {
  if (!winState[id]) winState[id] = { velX: 0, velY: 0, frame: null };
  return winState[id];
}

// ===== SOUND EFFECTS =====
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(startFreq, endFreq, duration) {
  const osc  = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(startFreq, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(endFreq, audioCtx.currentTime + duration);
  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + duration);
}

function playCloseSound() { playSound(250, 150, 0.25); }
function playOpenSound()  { playSound(200, 600, 0.25); }

// ===== PHYSICS =====
const DAMPING = 0.88;
const BOUNCE  = 0.6;
const SPRING  = 0.15;

function startGlide(win) {
  const id    = win.id;
  const state = getState(id);
  cancelAnimationFrame(state.frame);

  function glide() {
    const maxLeft = window.innerWidth  - win.offsetWidth;
    const maxTop  = window.innerHeight - win.offsetHeight;

    let left = win.offsetLeft + state.velX;
    let top  = win.offsetTop  + state.velY;

    const offR = left > window.innerWidth;
    const offL = left + win.offsetWidth  < 0;
    const offB = top  > window.innerHeight;
    const offT = top  + win.offsetHeight < 0;

    if (offR) state.velX += (maxLeft - left) * SPRING;
    if (offL) state.velX += (0 - left) * SPRING;
    if (offB) state.velY += (maxTop - top) * SPRING;
    if (offT) state.velY += (0 - top) * SPRING;

    left = win.offsetLeft + state.velX;
    top  = win.offsetTop  + state.velY;

    if (left <= 0)       { left = 0;       state.velX =  Math.abs(state.velX) * BOUNCE; }
    if (left >= maxLeft) { left = maxLeft;  state.velX = -Math.abs(state.velX) * BOUNCE; }
    if (top  <= 0)       { top  = 0;        state.velY =  Math.abs(state.velY) * BOUNCE; }
    if (top  >= maxTop)  { top  = maxTop;   state.velY = -Math.abs(state.velY) * BOUNCE; }

    state.velX *= DAMPING;
    state.velY *= DAMPING;

    win.style.left = left + 'px';
    win.style.top  = top  + 'px';

    const offScreen = offR || offL || offB || offT;
    if (Math.abs(state.velX) > 0.3 || Math.abs(state.velY) > 0.3 || offScreen) {
      state.frame = requestAnimationFrame(glide);
    }
  }

  state.frame = requestAnimationFrame(glide);
}

// ===== DRAGGABLE WINDOWS =====
function makeDraggable(win) {
  const titlebar = win.querySelector('.window-titlebar');
  let dragging = false;
  let startX, startY, startLeft, startTop, lastX, lastY;
  const state = getState(win.id);

  titlebar.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('tl-btn')) return;
    cancelAnimationFrame(state.frame);
    dragging  = true;
    startX    = e.clientX;
    startY    = e.clientY;
    startLeft = win.offsetLeft;
    startTop  = win.offsetTop;
    lastX = e.clientX;
    lastY = e.clientY;
    state.velX = 0; state.velY = 0;
    win.style.zIndex = getTopZ();
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    state.velX = e.clientX - lastX;
    state.velY = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    win.style.left = (startLeft + e.clientX - startX) + 'px';
    win.style.top  = (startTop  + e.clientY - startY) + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    const vw = window.innerWidth, vh = window.innerHeight;
    if (win.offsetLeft > vw)                   state.velX = -8;
    if (win.offsetLeft + win.offsetWidth  < 0) state.velX =  8;
    if (win.offsetTop  > vh)                   state.velY = -8;
    if (win.offsetTop  + win.offsetHeight < 0) state.velY =  8;
    startGlide(win);
  });
}

// ===== RESIZABLE WINDOWS (all 8 directions) =====
function makeResizable(win) {
  win.querySelectorAll('.resize-handle').forEach(handle => {
    let resizing = false;
    let startX, startY, startW, startH, startLeft, startTop;
    let dir = '';

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      resizing  = true;
      dir       = [...handle.classList].find(c => c.startsWith('resize-') && c !== 'resize-handle').replace('resize-', '');
      startX    = e.clientX;
      startY    = e.clientY;
      startW    = win.offsetWidth;
      startH    = win.offsetHeight;
      startLeft = win.offsetLeft;
      startTop  = win.offsetTop;
      win.style.zIndex = getTopZ();
    });

    document.addEventListener('mousemove', (e) => {
      if (!resizing) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const MIN_W = 200, MIN_H = 100;

      let newW = startW, newH = startH, newL = startLeft, newT = startTop;

      // Horizontal
      if (dir.includes('e')) newW = Math.max(MIN_W, startW + dx);
      if (dir.includes('w')) { newW = Math.max(MIN_W, startW - dx); newL = startLeft + (startW - newW); }

      // Vertical
      if (dir.includes('s')) newH = Math.max(MIN_H, startH + dy);
      if (dir.includes('n')) { newH = Math.max(MIN_H, startH - dy); newT = startTop  + (startH - newH); }

      win.style.width  = newW + 'px';
      win.style.height = newH + 'px';
      win.style.left   = newL + 'px';
      win.style.top    = newT + 'px';
    });

    document.addEventListener('mouseup', () => { resizing = false; });
  });
}

let zCounter = 10;
function getTopZ() { return ++zCounter; }

// ===== CLOSE / REOPEN =====
document.querySelectorAll('.tl-close').forEach((btn) => {
  btn.addEventListener('click', () => {
    const winId = btn.getAttribute('data-target');
    if (!winId) return;                              // sub-window buttons use data-subtarget; skip them
    const win   = document.getElementById(winId);
    const badge = document.getElementById(winId.replace('window-', 'badge-'));
    badge.style.left = win.style.left || win.offsetLeft + 'px';
    badge.style.top  = win.style.top  || win.offsetTop  + 'px';
    playCloseSound();
    win.classList.add('hidden');
    badge.classList.add('visible');
  });
});

document.querySelectorAll('.minimised-badge').forEach((badge) => {
  badge.addEventListener('click', () => {
    const winId = badge.getAttribute('data-target');
    const win   = document.getElementById(winId);
    win.style.left = badge.style.left;
    win.style.top  = badge.style.top;
    playOpenSound();
    win.classList.remove('hidden');
    badge.classList.remove('visible');
    win.style.zIndex = getTopZ();
  });
});


// ===== CONTACT WINDOW =====
const contactWin = document.getElementById('window-contact');

// Open from Links window email button
document.getElementById('open-contact').addEventListener('click', () => {
  contactWin.classList.remove('hidden');
  contactWin.style.zIndex = getTopZ();
  playOpenSound();
});

// Close button (no badge — just hides)
document.querySelector('.tl-close-contact').addEventListener('click', () => {
  contactWin.classList.add('hidden');
  playCloseSound();
});

// Form submission via Formspree — your email stays server-side, never in the code
// Sign up at formspree.io, create a form, and paste your endpoint below
document.getElementById('contact-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form   = e.target;
  const status = document.getElementById('contact-status');
  const btn    = form.querySelector('.contact-submit');

  btn.disabled    = true;
  btn.textContent = 'Sending...';
  status.style.color = '#aaa';
  status.textContent = '';

  try {
    const res = await fetch('/contact', {
      method: 'POST',
      body: JSON.stringify({ name: form.name.value, email: form.email.value, message: form.message.value }),
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      status.style.color = '#7ef7a0';
      status.textContent = 'Message sent!';
      form.reset();
    } else {
      throw new Error();
    }
  } catch {
    status.style.color = '#ff7b7b';
    status.textContent = 'Something went wrong. Try again.';
  }

  btn.disabled    = false;
  btn.textContent = 'Send';
});

// ===== CASSETTE PLAYER =====
(function () {
  const vid    = document.getElementById('cassette-video');
  const audio  = document.getElementById('cassette-audio');
  const btn    = document.getElementById('cassette-play');
  const vol    = document.getElementById('cassette-volume');

  audio.volume = parseFloat(vol.value);

  btn.addEventListener('click', () => {
    if (audio.paused) {
      audio.play();
      vid.play();
      btn.innerHTML = '&#10074;&#10074;';
    } else {
      audio.pause();
      vid.pause();
      btn.innerHTML = '&#9654;';
    }
  });

  vol.addEventListener('input', () => {
    audio.volume = parseFloat(vol.value);
  });
})();

// ===== EXIT BUTTON =====
document.getElementById('exit-btn').addEventListener('click', () => {
  const introScreen = document.getElementById('intro-screen');
  introScreen.classList.remove('fade-out');
  introScreen.style.display = '';
  introScreen.style.opacity = '';
});

// ===== INIT =====
document.querySelectorAll('.window').forEach(makeDraggable);
document.querySelectorAll('.window').forEach(makeResizable);
