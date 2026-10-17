/**
 * Shared, pure helpers for native react-grid-layout v2 state.
 */
import type { Layout } from 'react-grid-layout';

/** Compare only persisted geometry, not transient drag/resize metadata. */
export const hasGridGeometryChanged = (previous: Layout, next: Layout): boolean => {
  if (previous.length !== next.length) return true;
  const positions = new Map(previous.map(({ i, x, y, w, h }) => [
    i, { x, y, w, h },
  ]));
  return next.some(({ i, x, y, w, h }) => {
    const old = positions.get(i);
    return !old || old.x !== x || old.y !== y || old.w !== w || old.h !== h;
  });
};
