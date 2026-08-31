/**
 * Auto-board layout compatibility helpers.
 *
 * The old auto board used a 12-column desktop grid. Version 2 uses a
 * DataEase-style 72-column desktop grid and a 24-column mobile grid. Widget
 * ids and all chart/query configuration remain unchanged; only pRect/mRect
 * coordinates are converted.
 */
import {
  AUTO_GRID_COLS,
  AUTO_LAYOUT_VERSION,
  BASE_ROW_HEIGHT,
  LEGACY_AUTO_GRID_COLS,
  LEGACY_BASE_ROW_HEIGHT,
  LEGACY_MOBILE_GRID_COLS,
  MOBILE_LAYOUT_VERSION,
  MOBILE_GRID_COLS,
  PC_ROW_LAYOUT_VERSION,
} from '../constants';
import { RectConfig } from '../pages/Board/slice/types';
import { Widget } from '../types/widgetTypes';

const roundPositive = (value: number, minimum = 0) =>
  Math.max(minimum, Math.round(Number(value) || 0));

export const scaleAutoRect = (
  rect: RectConfig,
  sourceCols: number,
  targetCols: number,
): RectConfig => {
  const ratio = targetCols / sourceCols;
  return {
    ...rect,
    x: roundPositive(rect.x * ratio),
    y: roundPositive(rect.y),
    width: roundPositive(rect.width * ratio, 1),
    height: roundPositive(rect.height, 1),
  };
};

/** Convert a legacy widget without mutating its original server object. */
export const migrateAutoWidgetLayout = (widget: Widget): Widget => {
  const pRect = widget.config.pRect || widget.config.rect;
  const mRect = widget.config.mRect || pRect;

  return {
    ...widget,
    config: {
      ...widget.config,
      pRect: scaleAutoRect(pRect, LEGACY_AUTO_GRID_COLS, AUTO_GRID_COLS),
      mRect: scaleAutoRect(mRect, LEGACY_AUTO_GRID_COLS, MOBILE_GRID_COLS),
    },
  };
};

const migrateMobileAutoWidgetLayout = (widget: Widget): Widget => {
  const mRect = widget.config.mRect;
  return {
    ...widget,
    config: {
      ...widget.config,
      mRect: mRect
        ? scaleAutoRect(mRect, LEGACY_MOBILE_GRID_COLS, MOBILE_GRID_COLS)
        : normalizeAutoRectForCols(widget.config.pRect, MOBILE_GRID_COLS),
    },
  };
};

const migratePcRowLayout = (widget: Widget): Widget => {
  const pRect = widget.config.pRect || widget.config.rect;
  const rowRatio = LEGACY_BASE_ROW_HEIGHT / BASE_ROW_HEIGHT;
  return {
    ...widget,
    config: {
      ...widget.config,
      pRect: {
        ...pRect,
        y: roundPositive(pRect.y * rowRatio),
        height: roundPositive(pRect.height * rowRatio, 1),
      },
    },
  };
};

export const migrateAutoWidgetsLayout = (
  widgets: Widget[],
  layoutVersion?: number,
  mobileLayoutVersion?: number,
  pcRowLayoutVersion?: number,
): Widget[] => {
  let result = widgets;
  if (layoutVersion !== AUTO_LAYOUT_VERSION) {
    result = result.map(migrateAutoWidgetLayout);
  } else if (mobileLayoutVersion !== MOBILE_LAYOUT_VERSION) {
    result = result.map(migrateMobileAutoWidgetLayout);
  }
  return pcRowLayoutVersion === PC_ROW_LAYOUT_VERSION
    ? result
    : result.map(migratePcRowLayout);
};

export const normalizeAutoRectForCols = (
  rect: RectConfig,
  targetCols: number,
): RectConfig => {
  return scaleAutoRect(rect, AUTO_GRID_COLS, targetCols);
};

/** 历史仪表盘没有移动端显示标记时，保持原有“全部展示”行为。 */
export const isMobileWidgetVisible = (widget: Widget) =>
  widget.config.mVisible !== false;
