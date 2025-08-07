/*
  Matrix digital rain implementation using a full-screen canvas.
  Adjustable via controls at the bottom of the page.
*/

const canvas = document.getElementById('matrix-canvas');
const ctx = canvas.getContext('2d', { alpha: false });

// UI elements
const toggleBtn = document.getElementById('toggle-controls');
const controls = document.getElementById('controls');
const charsInput = document.getElementById('chars');
const fontSizeInput = document.getElementById('fontSize');
const fontSizeOut = document.getElementById('fontSizeOut');
const speedInput = document.getElementById('speed');
const speedOut = document.getElementById('speedOut');
const charRateInput = document.getElementById('charRate');
const charRateOut = document.getElementById('charRateOut');
const densityInput = document.getElementById('density');
const densityOut = document.getElementById('densityOut');
const fadeInput = document.getElementById('fade');
const fadeOut = document.getElementById('fadeOut');
const glowInput = document.getElementById('glow');
const glowOut = document.getElementById('glowOut');
const bgColorInput = document.getElementById('bgColor');
const trailColorInput = document.getElementById('trailColor');
const headColorInput = document.getElementById('headColor');
const pausedCheckbox = document.getElementById('paused');
const preventOverlapCheckbox = document.getElementById('preventOverlap');
const resetBtn = document.getElementById('reset');
const presetSelect = document.getElementById('presetSelect');
const presetNameInput = document.getElementById('presetName');
const savePresetBtn = document.getElementById('savePreset');
const deletePresetBtn = document.getElementById('deletePreset');

// State
const state = {
  characters: charsInput.value,
  fontSize: Number(fontSizeInput.value),
  speedDropsPerSecond: Number(speedInput.value),
  charChangeHz: Number(charRateInput ? charRateInput.value : 8),
  densityMultiplier: Number(densityInput.value),
  fadeAmount: Number(fadeInput.value),
  headGlow: Number(glowInput.value),
  bgColor: bgColorInput.value,
  trailColor: trailColorInput.value,
  headColor: headColorInput.value,
  paused: false,
  preventOverlap: true,
};

// Canvas + layout
let devicePixelRatioCached = window.devicePixelRatio || 1;
let numColumns = 0;
let columnXPositions = [];
let streams = [];
let lastTimestamp = performance.now();
let accumulator = 0; // for variable update rate

function resizeCanvasToDisplaySize() {
  const dpr = window.devicePixelRatio || 1;
  const width = Math.floor(window.innerWidth * dpr);
  const height = Math.floor(window.innerHeight * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  devicePixelRatioCached = dpr;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  recomputeColumns();
}

function recomputeColumns() {
  const widthCss = window.innerWidth;
  const fontSize = Math.max(8, state.fontSize);
  numColumns = Math.floor(widthCss / fontSize);
  columnXPositions = new Array(numColumns).fill(0).map((_, i) => i * fontSize);
  recomputeStreams();
}

function recomputeStreams() {
  const totalStreams = Math.max(1, Math.floor(numColumns * clamp(state.densityMultiplier, 0.1, 8)));
  streams = new Array(totalStreams).fill(0).map(() => ({
    columnIndex: Math.floor(Math.random() * Math.max(1, numColumns)),
    y: Math.floor(-Math.random() * window.innerHeight),
    char: randomChar(state.characters),
    prevChar: randomChar(state.characters),
    charTimer: 0,
  }));
}

function clearWithTrail() {
  // Apply fade by drawing a translucent rect over the frame
  ctx.fillStyle = hexToRgba(state.bgColor, state.fadeAmount);
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
}

function drawFrame(deltaSeconds) {
  if (state.paused) return;

  // Drop rate: how many rows per second each stream advances
  const pixelsPerSecond = state.speedDropsPerSecond * state.fontSize * 1.2;
  const deltaPixels = pixelsPerSecond * deltaSeconds;

  ctx.font = `${state.fontSize}px monospace`;
  ctx.textBaseline = 'top';

  // Slightly different trail/head colors
  const trail = state.trailColor;
  const head = state.headColor;

  for (let i = 0; i < streams.length; i++) {
    const s = streams[i];
    const x = columnXPositions[s.columnIndex] ?? 0;
    let y = s.y;

    // Update character based on requested change rate (0 freezes)
    if (state.charChangeHz > 0) {
      const interval = 1 / state.charChangeHz;
      s.charTimer += deltaSeconds;
      while (s.charTimer >= interval) {
        s.charTimer -= interval;
        s.prevChar = s.char;
        s.char = randomChar(state.characters);
      }
    }

    // Draw head with glow
    if (state.headGlow > 0) {
      ctx.shadowColor = head;
      ctx.shadowBlur = 10 * state.headGlow;
    } else {
      ctx.shadowBlur = 0;
    }
    if (state.preventOverlap) {
      // Snap to grid rows so characters do not overlap at the same position
      const snappedY = Math.round(y / state.fontSize) * state.fontSize;
      ctx.fillStyle = head;
      ctx.fillText(s.char, x, snappedY);
      ctx.shadowBlur = 0;
      ctx.fillStyle = trail;
      ctx.fillText(s.prevChar, x, snappedY - state.fontSize);
    } else {
      ctx.fillStyle = head;
      ctx.fillText(s.char, x, y);
      // Draw a trailing character above with trail color at raw position
      ctx.shadowBlur = 0;
      ctx.fillStyle = trail;
      ctx.fillText(s.prevChar, x, y - state.fontSize);
    }

    y += deltaPixels;
    if (y > window.innerHeight + state.fontSize) {
      y = Math.floor(-Math.random() * window.innerHeight * 0.5);
      // Randomize column occasionally to distribute load
      if (Math.random() < 0.2 && numColumns > 0) {
        s.columnIndex = Math.floor(Math.random() * numColumns);
      }
      if (state.charChangeHz > 0) {
        s.prevChar = s.char;
        s.char = randomChar(state.characters);
        s.charTimer = 0;
      }
    }
    s.y = y;
  }
}

function render(timestamp) {
  const dt = Math.min(0.05, (timestamp - lastTimestamp) / 1000); // cap to avoid big jumps
  lastTimestamp = timestamp;

  clearWithTrail();
  drawFrame(dt);
  requestAnimationFrame(render);
}

// Utilities
function randomChar(pool) {
  const idx = Math.floor(Math.random() * pool.length);
  return pool.charAt(idx);
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function hexToRgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h.split('').map(c => c + c).join('');
  }
  const bigint = parseInt(h, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

// Wire up controls
toggleBtn.addEventListener('click', () => {
  const isCollapsed = controls.classList.toggle('collapsed');
  toggleBtn.textContent = isCollapsed ? '▲ Show Controls' : '▼ Hide Controls';
  toggleBtn.setAttribute('aria-expanded', String(!isCollapsed));
});

charsInput.addEventListener('input', () => {
  state.characters = charsInput.value || '01';
});

fontSizeInput.addEventListener('input', () => {
  state.fontSize = Number(fontSizeInput.value);
  fontSizeOut.textContent = fontSizeInput.value;
  recomputeColumns();
});

speedInput.addEventListener('input', () => {
  state.speedDropsPerSecond = Number(speedInput.value);
  speedOut.textContent = speedInput.value;
});

densityInput.addEventListener('input', () => {
  state.densityMultiplier = Number(densityInput.value);
  densityOut.textContent = densityInput.value;
  recomputeStreams();
});

fadeInput.addEventListener('input', () => {
  state.fadeAmount = Number(fadeInput.value);
  fadeOut.textContent = fadeInput.value;
});

glowInput.addEventListener('input', () => {
  state.headGlow = Number(glowInput.value);
  glowOut.textContent = glowInput.value;
});

bgColorInput.addEventListener('input', () => {
  state.bgColor = bgColorInput.value;
  document.documentElement.style.setProperty('--bg', state.bgColor);
});

trailColorInput.addEventListener('input', () => {
  state.trailColor = trailColorInput.value;
  document.documentElement.style.setProperty('--trail', state.trailColor);
});

headColorInput.addEventListener('input', () => {
  state.headColor = headColorInput.value;
  document.documentElement.style.setProperty('--head', state.headColor);
});

pausedCheckbox.addEventListener('change', () => {
  state.paused = pausedCheckbox.checked;
});

if (preventOverlapCheckbox) {
  preventOverlapCheckbox.addEventListener('change', () => {
    state.preventOverlap = preventOverlapCheckbox.checked;
  });
}

// --- Presets & Persistence (localStorage) ---
const LS_KEY = 'matrix_presets_v1';
const LS_LAST = 'matrix_last_state_v1';

function getUiState() {
  return {
    characters: charsInput.value,
    fontSize: Number(fontSizeInput.value),
    speedDropsPerSecond: Number(speedInput.value),
    charChangeHz: Number(charRateInput ? charRateInput.value : state.charChangeHz),
    densityMultiplier: Number(densityInput.value),
    fadeAmount: Number(fadeInput.value),
    headGlow: Number(glowInput.value),
    bgColor: bgColorInput.value,
    trailColor: trailColorInput.value,
    headColor: headColorInput.value,
    preventOverlap: Boolean(preventOverlapCheckbox ? preventOverlapCheckbox.checked : state.preventOverlap),
  };
}

function applyUiState(s) {
  if (!s) return;
  charsInput.value = s.characters;
  fontSizeInput.value = String(s.fontSize);
  speedInput.value = String(s.speedDropsPerSecond);
  if (charRateInput) charRateInput.value = String(s.charChangeHz ?? state.charChangeHz);
  densityInput.value = String(s.densityMultiplier);
  fadeInput.value = String(s.fadeAmount);
  glowInput.value = String(s.headGlow);
  bgColorInput.value = s.bgColor;
  trailColorInput.value = s.trailColor;
  headColorInput.value = s.headColor;
  if (preventOverlapCheckbox) preventOverlapCheckbox.checked = !!s.preventOverlap;

  // Update state from UI and downstream caches
  state.characters = charsInput.value;
  state.fontSize = Number(fontSizeInput.value);
  state.speedDropsPerSecond = Number(speedInput.value);
  state.charChangeHz = Number(charRateInput ? charRateInput.value : state.charChangeHz);
  state.densityMultiplier = Number(densityInput.value);
  state.fadeAmount = Number(fadeInput.value);
  state.headGlow = Number(glowInput.value);
  state.bgColor = bgColorInput.value;
  state.trailColor = trailColorInput.value;
  state.headColor = headColorInput.value;
  state.preventOverlap = Boolean(preventOverlapCheckbox ? preventOverlapCheckbox.checked : state.preventOverlap);

  document.documentElement.style.setProperty('--bg', state.bgColor);
  document.documentElement.style.setProperty('--trail', state.trailColor);
  document.documentElement.style.setProperty('--head', state.headColor);
  fontSizeOut.textContent = fontSizeInput.value;
  speedOut.textContent = speedInput.value;
  if (charRateOut && charRateInput) charRateOut.textContent = charRateInput.value;
  densityOut.textContent = densityInput.value;
  fadeOut.textContent = fadeInput.value;
  glowOut.textContent = glowInput.value;
  recomputeColumns();
  recomputeStreams();
}

function loadPresets() {
  try {
    const json = localStorage.getItem(LS_KEY);
    const list = json ? JSON.parse(json) : [];
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

function savePresets(list) {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

function refreshPresetOptions() {
  if (!presetSelect) return;
  const list = loadPresets();
  presetSelect.innerHTML = '';
  const opt = document.createElement('option');
  opt.value = '';
  opt.textContent = 'Select preset…';
  presetSelect.appendChild(opt);
  for (const p of list) {
    const o = document.createElement('option');
    o.value = p.name;
    o.textContent = p.name;
    presetSelect.appendChild(o);
  }
}

function saveLastState() {
  localStorage.setItem(LS_LAST, JSON.stringify(getUiState()));
}

function loadLastState() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_LAST) || 'null');
    if (s) applyUiState(s);
  } catch { /* ignore */ }
}

if (savePresetBtn) {
  savePresetBtn.addEventListener('click', () => {
    const name = (presetNameInput?.value || '').trim();
    if (!name) return;
    const list = loadPresets();
    const existingIdx = list.findIndex(p => p.name === name);
    const item = { name, values: getUiState() };
    if (existingIdx >= 0) list[existingIdx] = item; else list.push(item);
    savePresets(list);
    refreshPresetOptions();
    presetSelect.value = name;
  });
}

if (deletePresetBtn) {
  deletePresetBtn.addEventListener('click', () => {
    const name = presetSelect?.value;
    if (!name) return;
    const list = loadPresets().filter(p => p.name !== name);
    savePresets(list);
    refreshPresetOptions();
    presetSelect.value = '';
  });
}

if (presetSelect) {
  presetSelect.addEventListener('change', () => {
    const name = presetSelect.value;
    const list = loadPresets();
    const found = list.find(p => p.name === name);
    if (found) applyUiState(found.values);
  });
}

// Persist changes live
for (const el of [charsInput, fontSizeInput, speedInput, charRateInput, densityInput, fadeInput, glowInput, bgColorInput, trailColorInput, headColorInput, preventOverlapCheckbox]) {
  if (!el) continue;
  el.addEventListener('input', () => {
    saveLastState();
  });
  el.addEventListener('change', () => {
    saveLastState();
  });
}

resetBtn.addEventListener('click', () => {
  fontSizeInput.value = '16';
  speedInput.value = '1.5';
  densityInput.value = '1.5';
  fadeInput.value = '0.08';
  glowInput.value = '0.6';
  bgColorInput.value = '#000000';
  trailColorInput.value = '#00ff88';
  headColorInput.value = '#ccffcc';
  charsInput.value = charsInput.defaultValue;

  // Update state and outputs
  state.characters = charsInput.value;
  state.fontSize = Number(fontSizeInput.value);
  state.speedDropsPerSecond = Number(speedInput.value);
  state.densityMultiplier = Number(densityInput.value);
  state.fadeAmount = Number(fadeInput.value);
  state.headGlow = Number(glowInput.value);
  state.bgColor = bgColorInput.value;
  state.trailColor = trailColorInput.value;
  state.headColor = headColorInput.value;
  document.documentElement.style.setProperty('--bg', state.bgColor);
  document.documentElement.style.setProperty('--trail', state.trailColor);
  document.documentElement.style.setProperty('--head', state.headColor);
  fontSizeOut.textContent = fontSizeInput.value;
  speedOut.textContent = speedInput.value;
  densityOut.textContent = densityInput.value;
  if (charRateInput && charRateOut) {
    charRateInput.value = '8';
    state.charChangeHz = Number(charRateInput.value);
    charRateOut.textContent = charRateInput.value;
  }
  recomputeStreams();
  fadeOut.textContent = fadeInput.value;
  glowOut.textContent = glowInput.value;
  pausedCheckbox.checked = false;
  state.paused = false;
  recomputeColumns();
});

// Init
window.addEventListener('resize', resizeCanvasToDisplaySize);
resizeCanvasToDisplaySize();

// Load last session state and presets
refreshPresetOptions();
loadLastState();

// Pre-fill bg on first frame to avoid flash
ctx.fillStyle = state.bgColor;
ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

requestAnimationFrame(render);


