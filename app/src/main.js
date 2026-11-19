// Neon Vice Cover Studio: wires the editor page. Pick photos, choose a
// layout and a colour grade, crop and position each panel, write the
// caption, and export the cover as a PNG in the post size you picked.
// A `?shot=` query sets up a fixed scene for a screenshot instead.
import { drawCover, LAYOUTS, GRADES, SIZES, layoutPanels } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const captionInput = document.getElementById('caption');
const taglineInput = document.getElementById('tagline');
const statusEl = document.getElementById('status');
const panelStrip = document.getElementById('panel-strip');
const zoomInput = document.getElementById('zoom');
const oxInput = document.getElementById('ox');
const oyInput = document.getElementById('oy');
const zoomVal = document.getElementById('zoom-val');

const SAMPLES = [
  { id: 'pier', label: 'Pier sunset' },
  { id: 'boulevard', label: 'Boulevard neon' },
  { id: 'skyline', label: 'Skyline dusk' },
];

// The photos the app can draw: samples plus whatever the user uploads.
const library = SAMPLES.map((s) => ({ id: s.id, label: s.label, url: `samples/${s.id}.jpg`, image: null }));
let uploadCount = 0;

const state = {
  layout: 'hero',
  grade: 'sunset',
  size: SIZES[2],
  caption: 'Sunset Heist',
  tagline: 'Vice City Nights',
  panels: [{}, {}, {}, {}],
  selected: 0,
};

function panelCount() {
  return LAYOUTS[state.layout].panels;
}

function redraw() {
  canvas.width = state.size.w;
  canvas.height = state.size.h;
  drawCover(canvas, state);
}

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function ensurePhoto(entry) {
  if (!entry.image) entry.image = await loadImage(entry.url);
  return entry.image;
}

async function assignPhoto(panelIndex, entryId) {
  const entry = library.find((e) => e.id === entryId) ?? null;
  const panel = state.panels[panelIndex];
  panel.photo = entry ? await ensurePhoto(entry) : null;
  panel.photoId = entry ? entry.id : null;
  redraw();
}

function buildPanelStrip() {
  panelStrip.innerHTML = '';
  for (let i = 0; i < panelCount(); i++) {
    const chip = document.createElement('div');
    chip.className = 'panel-chip' + (i === state.selected ? ' selected' : '');
    const label = document.createElement('button');
    label.type = 'button';
    label.textContent = `Panel ${i + 1}`;
    label.addEventListener('click', () => {
      state.selected = i;
      syncPanelControls();
      buildPanelStrip();
    });
    const select = document.createElement('select');
    select.setAttribute('aria-label', `Photo for panel ${i + 1}`);
    const none = document.createElement('option');
    none.value = '';
    none.textContent = 'Empty';
    select.appendChild(none);
    for (const entry of library) {
      const opt = document.createElement('option');
      opt.value = entry.id;
      opt.textContent = entry.label;
      select.appendChild(opt);
    }
    select.value = state.panels[i].photoId ?? '';
    select.addEventListener('change', async () => {
      await assignPhoto(i, select.value);
      buildPanelStrip();
    });
    chip.appendChild(label);
    chip.appendChild(select);
    panelStrip.appendChild(chip);
  }
}

function syncPanelControls() {
  const panel = state.panels[state.selected];
  zoomInput.value = String(panel.zoom ?? 1);
  oxInput.value = String(panel.ox ?? 0);
  oyInput.value = String(panel.oy ?? 0);
  zoomVal.textContent = `${Number(zoomInput.value).toFixed(2)}x`;
}

function bindPicker(id, apply) {
  const group = document.getElementById(id);
  group.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-value]');
    if (!btn) return;
    for (const b of group.querySelectorAll('button')) b.classList.toggle('active', b === btn);
    apply(btn.dataset.value);
  });
}

bindPicker('layout-picker', (value) => {
  state.layout = value;
  if (state.selected >= panelCount()) state.selected = 0;
  syncPanelControls();
  buildPanelStrip();
  redraw();
});

bindPicker('grade-picker', (value) => {
  state.grade = value;
  redraw();
});

bindPicker('size-picker', (value) => {
  state.size = SIZES.find((s) => s.id === value) ?? SIZES[0];
  redraw();
});

captionInput.addEventListener('input', () => {
  state.caption = captionInput.value;
  redraw();
});
taglineInput.addEventListener('input', () => {
  state.tagline = taglineInput.value;
  redraw();
});

zoomInput.addEventListener('input', () => {
  state.panels[state.selected].zoom = Number(zoomInput.value);
  zoomVal.textContent = `${Number(zoomInput.value).toFixed(2)}x`;
  redraw();
});
oxInput.addEventListener('input', () => {
  state.panels[state.selected].ox = Number(oxInput.value);
  redraw();
});
oyInput.addEventListener('input', () => {
  state.panels[state.selected].oy = Number(oyInput.value);
  redraw();
});

// Upload a photo of your own: it joins the library and can fill any panel.
document.getElementById('upload').addEventListener('change', async (e) => {
  for (const file of e.target.files) {
    uploadCount += 1;
    const entry = { id: `upload-${uploadCount}`, label: file.name, url: URL.createObjectURL(file), image: null };
    library.push(entry);
    await assignPhoto(state.selected, entry.id);
  }
  buildPanelStrip();
  statusEl.textContent = `${e.target.files.length} photo(s) added.`;
  e.target.value = '';
});

// Load a sample photo straight into the selected panel.
document.getElementById('sample-bar').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-sample]');
  if (!btn) return;
  await assignPhoto(state.selected, btn.dataset.sample);
  buildPanelStrip();
});

// Click a panel to select it; drag on the canvas to pan its photo.
let dragging = null;
function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * canvas.width,
    y: ((e.clientY - rect.top) / rect.height) * canvas.height,
  };
}
canvas.addEventListener('pointerdown', (e) => {
  const p = canvasPoint(e);
  const rects = layoutPanels(state.layout, canvas.width, canvas.height);
  for (let i = 0; i < rects.length; i++) {
    const [x, y, w, h] = rects[i];
    if (p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h) {
      state.selected = i;
      syncPanelControls();
      buildPanelStrip();
      dragging = { x: p.x, y: p.y, ox: state.panels[i].ox ?? 0, oy: state.panels[i].oy ?? 0 };
      canvas.setPointerCapture(e.pointerId);
      break;
    }
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const p = canvasPoint(e);
  const panel = state.panels[state.selected];
  panel.ox = dragging.ox + (p.x - dragging.x) / canvas.width;
  panel.oy = dragging.oy + (p.y - dragging.y) / canvas.height;
  syncPanelControls();
  redraw();
});
canvas.addEventListener('pointerup', () => { dragging = null; });

// Export the cover at the chosen post size as a PNG download.
document.getElementById('export').addEventListener('click', () => {
  canvas.toBlob((blob) => {
    if (!blob) {
      statusEl.textContent = 'Export failed.';
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `neon-vice-cover-${state.size.id}.png`;
    a.click();
    statusEl.textContent = `Saved neon-vice-cover-${state.size.id}.png (${state.size.w} x ${state.size.h}).`;
  }, 'image/png');
});

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  runShot(shot, params, async (sample, caption, tagline, layout, grade, sizeId) => {
    state.layout = layout;
    state.grade = grade;
    state.size = SIZES.find((s) => s.id === sizeId) ?? SIZES[0];
    state.caption = caption;
    state.tagline = tagline;
    captionInput.value = caption;
    taglineInput.value = tagline;
    for (const b of document.querySelectorAll('#layout-picker button')) b.classList.toggle('active', b.dataset.value === layout);
    for (const b of document.querySelectorAll('#grade-picker button')) b.classList.toggle('active', b.dataset.value === grade);
    for (const b of document.querySelectorAll('#size-picker button')) b.classList.toggle('active', b.dataset.value === sizeId);
    // Fill every panel with the sample so the cover is full, each panel
    // panned to a different slice of the photo, then redraw.
    for (let i = 0; i < panelCount(); i++) await assignPhoto(i, sample);
    for (let i = 0; i < panelCount(); i++) {
      state.panels[i].ox = (i - (panelCount() - 1) / 2) * 0.35;
      state.panels[i].oy = 0;
    }
    redraw();
    state.selected = 0;
    syncPanelControls();
    buildPanelStrip();
  });
} else {
  // First run: the pier sample in the hero panel, the rest empty.
  assignPhoto(0, 'pier').then(() => {
    syncPanelControls();
    buildPanelStrip();
  });
}
