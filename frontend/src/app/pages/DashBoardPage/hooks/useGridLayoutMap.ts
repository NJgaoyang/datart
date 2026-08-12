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
import { Layouts } from 'react-grid-layout';
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
): WidgetLayoutConstraints => {
  if (BUTTON_TYPES.has(originalType)) {
    return { minW: 2, maxW: 12, minH: 1, maxH: 40 };
  }
  if (CONTROLLER_TYPES.has(originalType)) {
    return { minW: 3, maxW: 8, minH: 1, maxH: 3 };
  }
  // 图表 / 媒体 / 容器等 —— 宽松约束
  return { minW: 1, maxW: 12, minH: 1, maxH: 40 };
};

export default function useGridLayoutMap(layoutWidgets: Widget[]) {
  const layoutMap = useMemo(() => {
    const layoutMap: Layouts = {
      lg: [],
      sm: [],
    };
    layoutWidgets.forEach(widget => {
      const lg = widget.config.pRect || widget.config.mRect || {};
      const sm = widget.config.mRect || widget.config.pRect || {};
      const lock = widget.config.lock;
      const constraints = getWidgetConstraints(widget.config.originalType);

      layoutMap.lg.push({
        i: widget.id,
        x: lg.x,
        y: lg.y,
        w: lg.width,
        h: lg.height,
        static: lock,
        minW: constraints.minW,
        maxW: constraints.maxW,
        minH: constraints.minH,
        maxH: constraints.maxH,
      });
      layoutMap.sm.push({
        i: widget.id,
        x: sm.x,
        y: sm.y,
        w: sm.width,
        h: sm.height,
        static: lock,
        minW: constraints.minW,
        maxW: constraints.maxW,
        minH: constraints.minH,
        maxH: constraints.maxH,
      });
    });
    return layoutMap;
  }, [layoutWidgets]);
  return layoutMap;
}
