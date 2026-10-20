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

import { BoardContext } from 'app/pages/DashBoardPage/components/BoardProvider/BoardProvider';
import {
  BASE_ROW_HEIGHT,
  MOBILE_ROW_HEIGHT,
} from 'app/pages/DashBoardPage/constants';
import { boardActions } from 'app/pages/DashBoardPage/pages/Board/slice';
import { useContext, useLayoutEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import useResizeObserver from './useResizeObserver';
import { getAdaptiveGridColsKey, getGridCanvasWidth } from 'app/pages/DashBoardPage/utils/gridViewport';

export const useGridWidgetHeight = (mobilePreview?: boolean) => {
  const { boardId, renderMode, isMobile } = useContext(BoardContext);
  const mobileMode = mobilePreview ?? isMobile ?? false;
  const dispatch = useDispatch();
  const [cacheW, setCacheW] = useState(0);
  const { ref, width = 0, height = 0 } = useResizeObserver<HTMLDivElement>();

  useLayoutEffect(() => {
    if (width > 0) {
      setCacheW(width);
      if (height > 0 && renderMode !== 'edit') {
        dispatch(
          boardActions.setBoardWidthHeight({ boardId, wh: [width, height] }),
        );
      }
    }
  }, [width, height, dispatch, boardId, renderMode]);

  const colsKey = getAdaptiveGridColsKey(cacheW, mobileMode);
  const canvasWidth = getGridCanvasWidth(cacheW, mobileMode);
  const widgetRowHeight = mobileMode ? MOBILE_ROW_HEIGHT : BASE_ROW_HEIGHT;

  return { ref, widgetRowHeight, colsKey, canvasWidth, containerWidth: cacheW };
};
