import { BREAK_POINT_MAP } from '../constants';

/** Use the grid container's measured width, not window.innerWidth:
 * editor sidebars and split panes can leave a desktop viewport with too
 * little space for several date/filter inputs side by side.
 */
export const getAdaptiveGridColsKey = (containerWidth: number): 'lg' | 'sm' =>
  containerWidth > 0 && containerWidth <= BREAK_POINT_MAP.md ? 'sm' : 'lg';
