/**
 * Datart
 *
 * Copyright 2021
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { useMemo } from 'react';
import type { LayoutItem, ResponsiveLayouts } from 'react-grid-layout';
import { LAYOUT_COLS_MAP } from '../constants';
import { normalizeAutoRectForCols } from '../utils/autoLayout';
import { RectConfig } from '../pages/Board/slice/types';
import { Widget } from '../types/widgetTypes';

/** 按钮类型 widget（查询/重置）—— 可自由调整大小 */
const BUTTON_TYPES: ReadonlySet<string> = new Set(['queryBtn', 'resetBtn']);

/** 筛选器控件类型 —— 高度通常 1-2 行即可 */
const CONTROLLER_TYPES: ReadonlySet<string> = new Set([
  'dropdownList',
  'multiDropdownList',
  'dropDownTree',
  'radioGroup',
  'checkboxGroup',
  'text',
  'value',
  'rangeValue',
  'slider',
  'time',
  'rangeTime',
]);

interface WidgetLayoutConstraints {
  minW?: number;
  maxW?: number;
  minH?: number;
  maxH?: number;
}

const getWidgetConstraints = (
  originalType: string,
  mobile = false,
): WidgetLayoutConstraints => {
  if (BUTTON_TYPES.has(originalType)) {
    return { maxW: mobile ? 24 : 72, maxH: mobile ? 40 : 160 };
  }
  if (CONTROLLER_TYPES.has(originalType)) {
    return {
      minW: mobile ? 1 : 18,
      maxW: mobile ? 24 : 48,
      minH: 1,
      maxH: mobile ? 3 : 12,
    };
  }
  // 图表 / 媒体 / 容器等 —— 宽松约束
  return { minW: 1, maxW: mobile ? 24 : 72, minH: 1, maxH: mobile ? 40 : 160 };
};

export default function useGridLayoutMap(layoutWidgets: Widget[]) {
  const layoutMap = useMemo<ResponsiveLayouts>(() => {
    const lg: LayoutItem[] = [];
    const sm: LayoutItem[] = [];
    layoutWidgets.forEach(widget => {
      const desktopRect = widget.config.pRect;
      const mobileRect: RectConfig =
        widget.config.mRect ||
        (widget.config.pRect
          ? normalizeAutoRectForCols(widget.config.pRect, LAYOUT_COLS_MAP.sm)
          : { x: 0, y: 0, width: 1, height: 1 });
      const lock = widget.config.lock;
      const constraints = getWidgetConstraints(widget.config.originalType);
      const mobileConstraints = getWidgetConstraints(
        widget.config.originalType,
        true,
      );

      lg.push({
        i: widget.id,
        x: desktopRect.x,
        y: desktopRect.y,
        w: desktopRect.width,
        h: desktopRect.height,
        static: lock,
        minW: constraints.minW,
        maxW: constraints.maxW,
        minH: constraints.minH,
        maxH: constraints.maxH,
      });
      sm.push({
        i: widget.id,
        x: mobileRect.x,
        y: mobileRect.y,
        w: mobileRect.width,
        h: mobileRect.height,
        static: lock,
        minW: mobileConstraints.minW,
        maxW: mobileConstraints.maxW,
        minH: mobileConstraints.minH,
        maxH: mobileConstraints.maxH,
      });
    });
    return { lg, sm };
  }, [layoutWidgets]);
  return layoutMap;
}
