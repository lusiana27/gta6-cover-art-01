// Neon Vice cover engine: draws a multi-panel GTA-style poster onto a canvas.
//
// A cover is a set of photo panels with slanted dividers, a sunset or neon
// colour grade over each photo, and a bold caption with a tagline. Every
// panel holds one photo, cropped and positioned by its own zoom and offset,
// so one photo can fill several panels or each panel can hold its own.
//
// The state it draws:
//   layout    'hero' | 'triptych' | 'quad' | 'single'
//   panels    [{ photo, zoom, ox, oy }] — one per panel of the layout
//   caption   the big words, drawn along the foot
//   tagline   the small words above the caption
//   grade     'sunset' | 'neon' | 'dusk' | 'noir'
//   size      { w, h } of the export (the canvas is sized to it)

export const LAYOUTS = {
  hero: { panels: 3, label: 'Hero split' },
  triptych: { panels: 3, label: 'Triptych' },
  quad: { panels: 4, label: 'Four up' },
  single: { panels: 1, label: 'Single frame' },
};

export const GRADES = {
  sunset: { label: 'Sunset', top: 'rgba(255, 170, 60, 0.10)', mid: 'rgba(255, 90, 60, 0.22)', low: 'rgba(190, 30, 110, 0.55)', accent: '#ffb347' },
  neon: { label: 'Neon', top: 'rgba(0, 229, 255, 0.10)', mid: 'rgba(255, 0, 160, 0.20)', low: 'rgba(120, 0, 190, 0.55)', accent: '#00e5ff' },
  dusk: { label: 'Dusk', top: 'rgba(140, 120, 255, 0.12)', mid: 'rgba(90, 60, 200, 0.22)', low: 'rgba(20, 20, 80, 0.55)', accent: '#b39dff' },
  noir: { label: 'Noir', top: 'rgba(255, 255, 255, 0.04)', mid: 'rgba(0, 0, 0, 0.18)', low: 'rgba(0, 0, 0, 0.60)', accent: '#f2f2f2' },
};

export const SIZES = [
  { id: '1080x1080', w: 1080, h: 1080, label: 'Square 1080 x 1080' },
  { id: '1080x1350', w: 1080, h: 1350, label: 'Portrait 1080 x 1350' },
  { id: '1920x1080', w: 1920, h: 1080, label: 'Wide 1920 x 1080' },
];

/** Panel rectangles for a layout, as fractions of the canvas: [x, y, w, h, slant]. */
export function layoutPanels(layout, w, h) {
  const slant = w * 0.03;
  if (layout === 'single') return [[0, 0, w, h, 0]];
  if (layout === 'triptych') {
    const pw = w / 3;
    return [
      [0, 0, pw, h, slant],
      [pw, 0, pw, h, slant],
      [pw * 2, 0, pw, h, slant],
    ];
  }
  if (layout === 'quad') {
    // All four panels slant the same way, so their shared edges meet and
    // no dark diamond opens where the four corners cross.
    const pw = w / 2;
    const ph = h / 2;
    return [
      [0, 0, pw, ph, slant],
      [pw, 0, pw, ph, slant],
      [0, ph, pw, ph, slant],
      [pw, ph, pw, ph, slant],
    ];
  }
  // hero: one tall panel left, two stacked right
  const left = w * 0.58;
  const right = w - left;
  return [
    [0, 0, left, h, slant],
    [left, 0, right, h / 2, -slant],
    [left, h / 2, right, h / 2, -slant],
  ];
}

/** Draws one photo into a slanted panel rect, cover-fit, with zoom and offset. */
function drawPanelPhoto(ctx, photo, rect, zoom, ox, oy) {
  const [x, y, w, h, slant] = rect;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + slant, y);
  ctx.lineTo(x + w + slant, y);
  ctx.lineTo(x + w - slant, y + h);
  ctx.lineTo(x - slant, y + h);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = '#241a30';
  ctx.fillRect(x - Math.abs(slant), y, w + Math.abs(slant) * 2, h);
  if (photo) {
    const base = Math.max(w / photo.naturalWidth, h / photo.naturalHeight);
    const scale = base * zoom;
    const pw = photo.naturalWidth * scale;
    const ph = photo.naturalHeight * scale;
    const cx = x + w / 2 + ox * w;
    const cy = y + h / 2 + oy * h;
    ctx.drawImage(photo, cx - pw / 2, cy - ph / 2, pw, ph);
  }
  ctx.restore();
}

/** The colour grade wash over one panel rect. */
function drawPanelGrade(ctx, rect, grade) {
  const [x, y, w, h, slant] = rect;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + slant, y);
  ctx.lineTo(x + w + slant, y);
  ctx.lineTo(x + w - slant, y + h);
  ctx.lineTo(x - slant, y + h);
  ctx.closePath();
  ctx.clip();
  const wash = ctx.createLinearGradient(x, y, x + w * 0.3, y + h);
  wash.addColorStop(0, grade.top);
  wash.addColorStop(0.55, grade.mid);
  wash.addColorStop(1, grade.low);
  ctx.fillStyle = wash;
  ctx.fillRect(x - Math.abs(slant), y, w + Math.abs(slant) * 2, h);
  ctx.restore();
}

/** A thin dark gutter plus a bright edge line along each panel's slant. */
function drawPanelFrame(ctx, rect) {
  const [x, y, w, h, slant] = rect;
  ctx.save();
  ctx.strokeStyle = 'rgba(10, 6, 16, 0.9)';
  ctx.lineWidth = Math.max(3, w * 0.006);
  ctx.beginPath();
  ctx.moveTo(x + slant, y);
  ctx.lineTo(x + w + slant, y);
  ctx.lineTo(x + w - slant, y + h);
  ctx.lineTo(x - slant, y + h);
  ctx.closePath();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = Math.max(1.5, w * 0.002);
  ctx.beginPath();
  ctx.moveTo(x + w + slant, y);
  ctx.lineTo(x + w - slant, y + h);
  ctx.stroke();
  ctx.restore();
}

/** Bold poster caption along the foot, with a black outline and a soft shadow. */
function drawCaption(ctx, w, h, caption, tagline, accent) {
  const text = (caption || '').trim().toUpperCase();
  const tag = (tagline || '').trim().toUpperCase();
  const bandH = h * 0.24;
  const band = ctx.createLinearGradient(0, h - bandH, 0, h);
  band.addColorStop(0, 'rgba(8, 4, 14, 0)');
  band.addColorStop(1, 'rgba(8, 4, 14, 0.78)');
  ctx.fillStyle = band;
  ctx.fillRect(0, h - bandH, w, bandH);

  const pad = w * 0.045;
  const base = h - h * 0.055;
  if (tag) {
    let tSize = h * 0.032;
    ctx.font = `700 ${tSize}px 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif`;
    try { ctx.letterSpacing = `${Math.max(2, h * 0.004)}px`; } catch { /* older canvas */ }
    ctx.textAlign = 'left';
    ctx.fillStyle = accent;
    ctx.fillText(tag, pad, base - h * 0.115);
    try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
  }
  if (!text) return;
  let size = h * 0.11;
  ctx.font = `900 ${size}px 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif`;
  try { ctx.letterSpacing = '1px'; } catch { /* older canvas */ }
  while (ctx.measureText(text).width > w - pad * 2 && size > h * 0.02) {
    size -= 2;
    ctx.font = `900 ${size}px 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif`;
  }
  ctx.save();
  ctx.translate(pad, base);
  ctx.rotate(-0.02);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(8, 4, 14, 0.9)';
  ctx.lineWidth = Math.max(2, size * 0.14);
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(255, 60, 140, 0.55)';
  ctx.shadowBlur = size * 0.18;
  ctx.fillText(text, 0, 0);
  ctx.restore();
  try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
}

/** Draws the whole cover for `state` onto `canvas` at the canvas's own size. */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#120a1a';
  ctx.fillRect(0, 0, w, h);
  const rects = layoutPanels(state.layout, w, h);
  const count = LAYOUTS[state.layout]?.panels ?? 1;
  for (let i = 0; i < count; i++) {
    const panel = state.panels[i] ?? {};
    const photo = panel.photo ?? null;
    if (state.grade === 'noir' && photo) {
      ctx.save();
      ctx.filter = 'grayscale(1) contrast(1.15)';
      drawPanelPhoto(ctx, photo, rects[i], panel.zoom ?? 1, panel.ox ?? 0, panel.oy ?? 0);
      ctx.restore();
    } else {
      drawPanelPhoto(ctx, photo, rects[i], panel.zoom ?? 1, panel.ox ?? 0, panel.oy ?? 0);
    }
    drawPanelGrade(ctx, rects[i], grade);
  }
  for (let i = 0; i < count; i++) drawPanelFrame(ctx, rects[i]);
  // A soft sun glow behind the caption, strongest for the sunset grade.
  const glow = ctx.createRadialGradient(w * 0.78, h * 0.82, 0, w * 0.78, h * 0.82, w * 0.5);
  glow.addColorStop(0, state.grade === 'neon' ? 'rgba(0, 229, 255, 0.20)' : 'rgba(255, 140, 60, 0.22)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  drawCaption(ctx, w, h, state.caption, state.tagline, grade.accent);
}
