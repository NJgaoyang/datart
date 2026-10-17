/**
 * Shared, pure helpers for native react-grid-layout v2 state.
 */
import type { Layout } from 'react-grid-layout';
import type { Widget } from '../types/widgetTypes';
import { LAYOUT_COLS_MAP } from '../constants';
import { normalizeAutoRectForCols } from './autoLayout';

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

/** Use the current system's explicit mobile rectangle, or its responsive default. */
export const getMobileGridLayout = (widgets: Widget[]): Layout =>
  widgets.map(widget => {
    const rect =
      widget.config.mRect ||
      normalizeAutoRectForCols(widget.config.pRect, LAYOUT_COLS_MAP.sm);
    return {
      i: widget.id,
      x: rect.x,
      y: rect.y,
      w: rect.width,
      h: rect.height,
    };
  });
