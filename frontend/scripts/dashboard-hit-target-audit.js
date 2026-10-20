/**
 * Optional manual browser smoke audit: paste this file into DevTools > Sources
 * > Snippets while viewing/editing an authenticated dashboard and execute it.
 * Tests real DOM hit rectangles at the current zoom, scroll and viewport.
 * It does NOT click buttons or mutate the dashboard.
 */
(async () => {
  const buttons = Array.from(document.querySelectorAll(
    '.react-grid-item .widget-tool-dropdown, .controller-widget .widget-tool-dropdown',
  ));
  const results = [];
  for (const button of new Set(buttons)) {
    if (!(button instanceof HTMLElement)) continue;
    button.focus({ preventScroll: true });
    await new Promise(resolve => requestAnimationFrame(resolve));
    const box = button.getBoundingClientRect();
    if (!box.width || !box.height || box.right < 0 || box.bottom < 0
        || box.left > innerWidth || box.top > innerHeight) continue;
    const x = Math.max(0, Math.min(innerWidth - 1, box.left + box.width / 2));
    const y = Math.max(0, Math.min(innerHeight - 1, box.top + box.height / 2));
    const hit = document.elementFromPoint(x, y);
    const aligned = Boolean(hit && (hit === button || button.contains(hit)));
    results.push({
      widgetId: button.closest('[data-dashboard-widget-id]')?.getAttribute('data-dashboard-widget-id') || '(unknown)',
      aligned,
      centerX: Math.round(x),
      centerY: Math.round(y),
      buttonWidth: Math.round(box.width),
      buttonHeight: Math.round(box.height),
      interceptingElement: aligned ? '' : hit?.className || hit?.tagName || '(none)',
    });
    button.blur();
  }
  console.table(results);
  console.info('Viewport:', innerWidth, 'x', innerHeight,
    'zoom:', devicePixelRatio, 'aligned:', results.filter(r => r.aligned).length,
    '/', results.length);
  if (!results.length) console.warn('No visible widget action buttons found on this page.');
  if (results.some(r => !r.aligned)) {
    console.warn('Misaligned button hit targets detected; inspect the interceptingElement column.');
  }
})();
