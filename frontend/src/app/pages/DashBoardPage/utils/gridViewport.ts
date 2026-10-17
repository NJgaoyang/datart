import { BREAK_POINT_MAP } from '../constants';

/** A narrow desktop pane must not change the persisted mobile layout. */
export const getAdaptiveGridColsKey = (
  _containerWidth: number,
  mobileMode = false,
): 'lg' | 'sm' => mobileMode ? 'sm' : 'lg';

/** Desktop geometry keeps a readable minimum width, with horizontal scroll. */
export const getGridCanvasWidth = (
  containerWidth: number,
  mobileMode = false,
): number => mobileMode ? Math.max(0, containerWidth)
  : Math.max(containerWidth, BREAK_POINT_MAP.sm);
