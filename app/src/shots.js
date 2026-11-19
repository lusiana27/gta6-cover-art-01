// Fixed scenes for screenshots: ?shot=editor shows the page with a sample
// photo loaded; ?shot=cover shows the cover alone, filling the viewport.
// `photo` picks the sample (samples/<photo>.jpg), `caption` the words,
// `layout`, `grade` and `size` pick the cover's shape. The size also sizes
// the canvas, so a cover shot draws at its export size and the screenshot
// is the app's own drawing of it. window.__shotReady is set once painted.
export async function runShot(shot, query, load) {
  const sizeId = query.get('size') ?? '1920x1080';
  if (shot === 'cover') document.body.classList.add('shot-cover');
  await load(
    query.get('photo') ?? 'pier',
    query.get('caption') ?? 'Sunset Heist',
    query.get('tagline') ?? 'Vice City Nights',
    query.get('layout') ?? 'hero',
    query.get('grade') ?? 'sunset',
    sizeId,
  );
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
