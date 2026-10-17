/**
 * Shared, pure helpers for native react-grid-layout v2 state.
 */
import type { Layout } from 'react-grid-layout';
import type { Widget } from '../types/widgetTypes';

/** Compare only persisted geometry, not transient drag/resize metadata. */
export const hasGridGeometryChanged = (previous: Layout, next: Layout): boolean => {
  if (previous.length !== next.length) return true;
  const positions = new Map(previous.map(({ i, x, y, w, h }) => [
    i, { x, y, w, h },
  ] as const));
  return next.some(({ i, x, y, w, h }) => {
    const old = positions.get(i);
    return !old || old.x !== x || old.y !== y || old.w !== w || old.h !== h;
  });
};

/** Derive desktop placement from persisted widgets, never from a transient
 * editor layout belonging to whichever device was most recently selected.
 */
export const getDesktopGridLayout = (widgets: Widget[]): Layout =>
  widgets.map(widget => {
    const { x, y, width, height } = widget.config.pRect;
    return { i: widget.id, x, y, w: width, h: height };
  });
