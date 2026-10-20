import type { Layout } from 'react-grid-layout';

/** Do not hijack the arrow keys or delete/copy shortcuts from form controls. */
export const isTypingTarget = (target: EventTarget | null): boolean => {
  const element = target as Element | null;
  return Boolean(element && typeof element.closest === 'function'
    && element.closest(
      'input, textarea, select, [contenteditable="true"], [role="textbox"], ' +
      '[role="combobox"], [role="dialog"], [data-dashboard-hotkeys="off"]',
    ));
};

/**
 * Nudge a selected set together in whole grid units. Reject collisions,
 * locked widgets and out-of-bounds positions instead of displacing other
 * widgets or mutating their saved geometry during a keyboard gesture.
 */
export const nudgeGridLayout = (
  layout: Layout,
  selectedIds: ReadonlySet<string>,
  dx: number,
  dy: number,
  cols: number,
  allowOverlap = false,
): Layout => {
  if (selectedIds.size === 0 || (dx === 0 && dy === 0)) return layout;
  const selected = layout.filter(item => selectedIds.has(item.i));
  if (selected.length !== selectedIds.size || selected.some(item => item.static)) return layout;
  const moving = layout.map(item => selectedIds.has(item.i)
    ? { ...item, x: item.x + dx, y: item.y + dy }
    : item);
  const moved = moving.filter(item => selectedIds.has(item.i));
  if (moved.some(item => item.x < 0 || item.y < 0 || item.x + item.w > cols)) {
    return layout;
  }
  if (!allowOverlap) {
    const fixed = moving.filter(item => !selectedIds.has(item.i));
    const intersects = (a: Layout[number], b: Layout[number]) =>
      a.x < b.x + b.w && a.x + a.w > b.x
      && a.y < b.y + b.h && a.y + a.h > b.y;
    if (moved.some(a => fixed.some(b => intersects(a, b)))) return layout;
  }
  return moving;
};
