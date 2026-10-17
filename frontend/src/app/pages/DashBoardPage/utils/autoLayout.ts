/**
 * New automatic dashboard layout utilities.
 *
 * Historical grid conversion is intentionally excluded from the runtime.
 * A dedicated migration subsystem will handle old dashboards separately.
 */
import { AUTO_GRID_COLS } from '../constants';
import { RectConfig } from '../pages/Board/slice/types';
import { Widget } from '../types/widgetTypes';

const toNonNegativeInteger = (value: number, minimum = 0): number =>
  Math.max(minimum, Math.round(Number(value) || 0));

/** Adapt a current desktop layout rectangle to another grid column count. */
export const scaleAutoRect = (
  rect: RectConfig,
  sourceCols: number,
  targetCols: number,
): RectConfig => {
  const ratio = targetCols / sourceCols;
  return {
    ...rect,
    x: toNonNegativeInteger(rect.x * ratio),
    y: toNonNegativeInteger(rect.y),
    width: toNonNegativeInteger(rect.width * ratio, 1),
    height: toNonNegativeInteger(rect.height, 1),
  };
};

export const normalizeAutoRectForCols = (
  rect: RectConfig,
  targetCols: number,
): RectConfig => scaleAutoRect(rect, AUTO_GRID_COLS, targetCols);

export const isMobileWidgetVisible = (widget: Widget): boolean =>
  widget.config.mVisible !== false;
