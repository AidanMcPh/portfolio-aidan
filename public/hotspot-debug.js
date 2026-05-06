// ===== HOTSPOT CALIBRATION TOOL =====
// Drag the 4 corner handles onto the monitor screen corners.
// The console prints the clip-path value to paste into styles.css.
// Remove the <script> tag for this file when done.

(function () {
  const wrapper  = document.getElementById('intro-wrapper');
  const hotspot  = document.getElementById('computer-hotspot');

  // Current corners as percentages [x, y]
  const corners = [
    [56, 3],   // top-left
    [99, 1],   // top-right
    [99, 71],  // bottom-right
    [56, 75],  // bottom-left
  ];
  const labels = ['TL', 'TR', 'BR', 'BL'];
  const colors = ['#f00', '#0f0', '#00f', '#ff0'];

  function applyPolygon() {
    const pts = corners.map(c => `${c[0]}% ${c[1]}%`).join(', ');
    hotspot.style.clipPath = `polygon(${pts})`;
    console.log(`clip-path: polygon(${pts});`);
  }

  function makeHandle(index) {
    const el = document.createElement('div');
    el.style.cssText = `
      position: absolute;
      width: 18px; height: 18px;
      background: ${colors[index]};
      border: 2px solid #fff;
      border-radius: 50%;
      cursor: grab;
      transform: translate(-50%, -50%);
      z-index: 99999;
      left: ${corners[index][0]}%;
      top:  ${corners[index][1]}%;
      box-shadow: 0 0 6px rgba(0,0,0,0.8);
    `;
    el.title = labels[index];

    let dragging = false;

    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragging = true;
      el.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const rect = wrapper.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width  * 100).toFixed(1);
      const y = ((e.clientY - rect.top)  / rect.height * 100).toFixed(1);
      corners[index] = [parseFloat(x), parseFloat(y)];
      el.style.left = x + '%';
      el.style.top  = y + '%';
      applyPolygon();
    });

    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      el.style.cursor = 'grab';
    });

    return el;
  }

  // Show the polygon fill so you can see the current shape
  hotspot.style.background = 'rgba(255, 100, 100, 0.25)';
  hotspot.style.pointerEvents = 'none'; // let handles take events

  applyPolygon();

  // Block the click-to-enter while calibrating
  hotspot.addEventListener('click', e => e.stopPropagation());

  for (let i = 0; i < 4; i++) {
    wrapper.appendChild(makeHandle(i));
  }

  console.log('%cHotspot calibrator active. Drag the coloured dots to the screen corners. Copy the clip-path from console output.', 'color: lime; font-weight: bold;');
})();
