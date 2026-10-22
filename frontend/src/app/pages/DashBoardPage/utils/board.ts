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

import {
  BoardInfo,
  BoardType,
  ColsKeyType,
  Dashboard,
  DataChart,
  DeviceType,
  ServerDashboard,
  ServerDatachart,
} from 'app/pages/DashBoardPage/pages/Board/slice/types';
import { ChartDataView } from 'app/types/ChartDataView';
import { View } from 'app/types/View';
import {
  createDateLevelComputedFieldForConfigComputedFields,
  mergeChartAndViewComputedField,
} from 'app/utils/chartHelper';
import { parseBoardConfig, serializeConfig } from 'app/utils/configParser';
import { transformMeta } from 'app/utils/internalChartHelper';
import { adaptBoardImageUrl } from '.';
import { BoardConfigValue } from '../components/BoardProvider/BoardConfigProvider';
import { MOBILE_MIN_MARGIN, MOBILE_MIN_PADDING } from '../constants';
import { BoardConfig } from '../types/boardTypes';
import { Widget } from '../types/widgetTypes';
import { initAutoBoardConfig } from './autoBoard';
import { initFreeBoardConfig } from './freeBoard';
import { ensureGridEngineSettings } from './gridEngineSettings';
import { ensureMobileBoardSettings } from './mobileBoardSettings';

export const getDashBoardByResBoard = (data: ServerDashboard): Dashboard => {
  return {
    id: data.id,
    queryVariables: data.queryVariables,
    name: data.name,
    orgId: data.orgId,
    parentId: data.parentId,
    status: data.status,
    thumbnail: data.thumbnail,
    index: data.index,
    config: preprocessBoardConfig(parseBoardConfig(data.config), data.id),
    permissions: data.permissions,
  };
};
export const preprocessBoardConfig = (config: BoardConfig, boardId: string) => {
  ensureMobileBoardSettings(config);
  ensureGridEngineSettings(config);
  config.jsonConfig.props.forEach(item => {
    if (item.key === 'background') {
      const rowsValue = item?.rows?.[0]?.value;
      if (rowsValue?.image) {
        rowsValue.image = adaptBoardImageUrl(rowsValue.image, boardId);
      }
    }
  });
  return config;
};
export const getScheduleBoardInfo = (
  boardInfo: BoardInfo,
  widgetMap: Record<string, Widget>,
) => {
  let newBoardInfo: BoardInfo = { ...boardInfo };
  const needFetchItems = Object.values(widgetMap)
    .filter(widget => {
      if (widget.viewIds && widget.viewIds.length > 0 && widget.viewIds[0]) {
        return true;
      }
      return false;
    })
    .map(widget => widget.id);

  newBoardInfo.needFetchItems = needFetchItems;

  return newBoardInfo;
};

export const getInitBoardInfo = (obj: {
  id: string;
  widgetIds?: string[];
  controllerWidgets?: Widget[];
}) => {
  //
  const boardInfo: BoardInfo = {
    id: obj.id,
    saving: false,
    loading: false,
    dragging: false,
    editing: false,
    visible: true,
    showBlockMask: true,
    fullScreenItemId: '',
    layouts: [],
    isDroppable: false,
    clipboardWidgetMap: {},
    widgetIds: obj.widgetIds || [],
    controllerPanel: {
      type: 'hide',
      widgetId: '',
    },

    linkFilter: [],

    deviceType: DeviceType.Desktop,
    needFetchItems: [],
    hasFetchItems: [],
    boardWidthHeight: [0, 0],
    originControllerWidgets: obj.controllerWidgets || [],
  };
  return boardInfo;
};

export const getInitBoardConfig = (boardType?: BoardType) => {
  if (boardType === 'auto') {
    return initAutoBoardConfig();
  } else {
    return initFreeBoardConfig();
  }
};
// dataCharts
export const getDataChartsByServer = (
  serverDataCharts: ServerDatachart[],
  view: View[],
) => {
  const dataCharts: DataChart[] = serverDataCharts.map(item => {
    const config = JSON.parse(item.config || '{}');
    const viewComputerFields =
      JSON.parse(view.find(v => v.id === item.viewId)?.model || '{}')
        ?.computedFields || [];

    config.computedFields = mergeChartAndViewComputedField(
      viewComputerFields,
      config.computedFields,
    );

    return {
      ...item,
      config,
    };
  });

  return dataCharts;
};

export const getChartDataView = (
  views: View[],
  dataCharts: DataChart[],
  additionalViewIds: string[] = [],
) => {
  const viewViews: ChartDataView[] = [];
  const usedViewIds = new Set([
    ...dataCharts.map(dataChart => dataChart.viewId).filter(Boolean),
    ...additionalViewIds.filter(Boolean),
  ]);
  views
    .filter(view => usedViewIds.has(view.id))
    .forEach(view => {
      const dataChart = dataCharts.find(dc => dc.viewId === view.id);

      if (view) {
      }
      if (view?.model) {
        view.model = serializeConfig(view.model);
      }
      const meta = transformMeta(view.model, view.fields, view.type);
      const viewComputedFields =
        JSON.parse(view.model || '{}').computedFields || [];
      const computedFields =
        createDateLevelComputedFieldForConfigComputedFields(
          meta,
          mergeChartAndViewComputedField(
            viewComputedFields,
            dataChart?.config.computedFields,
          ),
        );
      let viewView = {
        ...view,
        meta,
        model: '',
        computedFields,
      };
      viewViews.push(viewView);
    });
  return viewViews;
};

export const getBoardMarginPadding = (
  boardConfig: BoardConfigValue,
  colsKey: ColsKeyType,
): { curMargin: [number, number]; curPadding: [number, number] } => {
  // Grid gutters are visual pixels, not persisted pRect/mRect coordinates.
  // Opting out restores each board's existing configured margins and padding.
  if (boardConfig.seamlessSpacing !== false) {
    return { curMargin: [0, 0], curPadding: [0, 0] };
  }
  const { margin, padding, mMargin, mPadding } = boardConfig;
  const isMobile = colsKey === 'sm';
  return isMobile
    ? {
        curMargin: mMargin || [MOBILE_MIN_MARGIN, MOBILE_MIN_MARGIN],
        curPadding: mPadding || [MOBILE_MIN_PADDING, MOBILE_MIN_PADDING],
      }
    : {
        curMargin: margin,
        curPadding: padding,
      };
};

/**
 * RGL item height = h * rowHeight + (h - 1) * verticalMargin.
 * Removing a saved pixel gutter without changing rowHeight could shrink a
 * table by hundreds of pixels. Preserve the original grid row pitch while
 * allowing adjacent items to touch; persisted rectangles remain unchanged.
 */
export const getAutoBoardRowHeight = (
  boardConfig: BoardConfigValue,
  colsKey: ColsKeyType,
  baseRowHeight: number,
): number => {
  if (boardConfig.seamlessSpacing === false) {
    return baseRowHeight;
  }
  const oldMargin = colsKey === 'sm'
    ? boardConfig.mMargin?.[1] ?? MOBILE_MIN_MARGIN
    : boardConfig.margin?.[1] ?? 0;
  return baseRowHeight + Math.max(0, Number(oldMargin) || 0);
};

export const isElView = (el, inTimer?: boolean) => {
  let bool = false;
  if (!el) return false;
  let rect = el?.getBoundingClientRect();

  let { top, bottom, x, y, left, right } = rect;

  // freeBoard widget in storyPlayer return true
  const isFreeWidgetInStoryPlayer = top + bottom + x + y + left + right === 0;
  if (isFreeWidgetInStoryPlayer && !inTimer) return true;

  // top 元素顶端到可见区域顶端的距离
  // bottom 元素底部端到可见区域顶端的距离
  var viewHeight = window.innerHeight || document.documentElement.clientHeight; // 浏览器可见区域高度。

  if (top < viewHeight && bottom > 0) {
    bool = true;
  } else if (top >= viewHeight || bottom <= 0) {
    bool = false;
  }
  return bool;
};
