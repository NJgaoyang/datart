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

import { LeftOutlined } from '@ant-design/icons';
import { Empty } from 'antd';
import { useGridWidgetHeight } from 'app/hooks/useGridWidgetHeight';
import { BoardConfigValContext } from 'app/pages/DashBoardPage/components/BoardProvider/BoardConfigProvider';
import { BoardContext } from 'app/pages/DashBoardPage/components/BoardProvider/BoardProvider';
import StyledBackground from 'app/pages/DashBoardPage/components/WidgetComponents/StyledBackground';
import { WidgetWrapProvider } from 'app/pages/DashBoardPage/components/WidgetProvider/WidgetWrapProvider';
import {
  LAYOUT_COLS_MAP,
  WIDGET_DRAG_HANDLE,
} from 'app/pages/DashBoardPage/constants';
import useBoardScroll from 'app/pages/DashBoardPage/hooks/useBoardScroll';
import useEditAutoLayoutMap from 'app/pages/DashBoardPage/hooks/useEditAutoLayoutMap';
import useGridLayoutMap from 'app/pages/DashBoardPage/hooks/useGridLayoutMap';
import { DeviceType } from 'app/pages/DashBoardPage/pages/Board/slice/types';
import { getBoardMarginPadding } from 'app/pages/DashBoardPage/utils/board';
import { isMobileWidgetVisible } from 'app/pages/DashBoardPage/utils/autoLayout';
import debounce from 'lodash/debounce';
import { memo, useCallback, useContext, useMemo, useRef } from 'react';
import RGL, { Layout, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import { useDispatch, useSelector } from 'react-redux';
import 'react-resizable/css/styles.css';
import styled from 'styled-components';
import { LEVEL_100, LEVEL_DASHBOARD_EDIT_OVERLAY } from 'styles/StyleConstants';
import BoardOverlay from '../components/BoardOverlay';
import { editBoardStackActions, editDashBoardInfoActions } from '../slice';
import { selectDeviceType, selectEditingWidgetIds } from '../slice/selectors';
import { WidgetOfAutoEditor } from './WidgetOfAutoEditor';

const ReactGridLayout = WidthProvider(RGL);

export const AutoBoardEditor: React.FC<{}> = memo(() => {
  const dispatch = useDispatch();
  const { boardId, name } = useContext(BoardContext);
  const boardConfig = useContext(BoardConfigValContext);
  const { background, allowOverlap } = boardConfig;
  const deviceType = useSelector(selectDeviceType);
  const editingWidgetIds = useSelector(selectEditingWidgetIds);
  const { ref, widgetRowHeight, colsKey } = useGridWidgetHeight();
  // 编辑器本身通常仍然占用桌面宽度，不能用容器宽度判断移动端列数。
  const activeColsKey = deviceType === DeviceType.Mobile ? 'sm' : colsKey;

  const { curMargin, curPadding } = useMemo(() => {
    return getBoardMarginPadding(boardConfig, activeColsKey);
  }, [activeColsKey, boardConfig]);

  const currentLayout = useRef<Layout[]>([]);
  const pixelDragRef = useRef<{
    element: HTMLElement;
    startX: number;
    startY: number;
    left: number;
    top: number;
  } | null>(null);
  const pixelDragFrameRef = useRef<number | null>(null);

  const { gridWrapRef, thEmitScroll } = useBoardScroll(boardId);

  const sortedLayoutWidgets = useEditAutoLayoutMap(boardId);
  const visibleLayoutWidgets = useMemo(
    () =>
      deviceType === DeviceType.Mobile
        ? sortedLayoutWidgets.filter(isMobileWidgetVisible)
        : sortedLayoutWidgets,
    [deviceType, sortedLayoutWidgets],
  );
  const layoutMap = useGridLayoutMap(visibleLayoutWidgets);

  const changeWidgetLayouts = debounce((layouts: Layout[]) => {
    dispatch(
      editBoardStackActions.changeAutoBoardWidgetsRect({
        layouts,
        deviceType: deviceType,
      }),
    );
  }, 300);

  const clearPixelDrag = useCallback(() => {
    if (pixelDragFrameRef.current !== null) {
      cancelAnimationFrame(pixelDragFrameRef.current);
      pixelDragFrameRef.current = null;
    }
    if (pixelDragRef.current) {
      pixelDragRef.current.element.style.removeProperty('will-change');
      pixelDragRef.current.element.style.removeProperty('transform');
    }
    pixelDragRef.current = null;
  }, []);

  const onPixelDragStart = useCallback(
    (...args: any[]) => {
      const [, oldItem, , , event, element] = args;
      const grid = element?.closest('.react-grid-layout') as HTMLElement | null;
      if (!grid || !element || !event) return;

      const cols = LAYOUT_COLS_MAP[activeColsKey];
      const columnWidth =
        (grid.clientWidth - curMargin[0] * (cols - 1) - curPadding[0] * 2) /
        cols;
      pixelDragRef.current = {
        element,
        startX: event.clientX,
        startY: event.clientY,
        left: curPadding[0] + oldItem.x * (columnWidth + curMargin[0]),
        top: curPadding[1] + oldItem.y * (widgetRowHeight + curMargin[1]),
      };
      element.style.willChange = 'transform';
    },
    [activeColsKey, curMargin, curPadding, widgetRowHeight],
  );

  const onPixelDrag = useCallback((...args: any[]) => {
    const [, , , , event] = args;
    const drag = pixelDragRef.current;
    if (!drag || !event) return;

    const left = drag.left + event.clientX - drag.startX;
    const top = drag.top + event.clientY - drag.startY;
    if (pixelDragFrameRef.current !== null) {
      cancelAnimationFrame(pixelDragFrameRef.current);
    }
    pixelDragFrameRef.current = requestAnimationFrame(() => {
      if (pixelDragRef.current === drag) {
        drag.element.style.transform = `translate3d(${left}px, ${top}px, 0)`;
      }
      pixelDragFrameRef.current = null;
    });
  }, []);

  const onLayoutChange = (layouts: Layout[]) => {
    currentLayout.current = layouts;
    thEmitScroll();
    // ignore isDraggable item from out
    if (layouts.find(item => item.isDraggable === true)) {
      return;
    }
    dispatch(editDashBoardInfoActions.adjustDashLayouts(layouts));
  };

  const { deviceClassName } = useMemo(() => {
    let deviceClassName: string = 'desktop';
    if (deviceType === DeviceType.Mobile) {
      deviceClassName = 'mobile';
    }
    return {
      deviceClassName,
    };
  }, [deviceType]);

  const boardChildren = useMemo(() => {
    return visibleLayoutWidgets.map(item => {
      // TODO(Stephen): 将外层div与内层WidgetWrapProvider合并，同时修改FreeBoardEditor
      return (
        <div
          style={{
            zIndex: editingWidgetIds.includes(item?.id)
              ? LEVEL_DASHBOARD_EDIT_OVERLAY + 1
              : 'auto',
          }}
          key={item.id}
        >
          <WidgetWrapProvider
            id={item.id}
            boardEditing={true}
            boardId={boardId}
          >
            <WidgetOfAutoEditor />
          </WidgetWrapProvider>
        </div>
      );
    });
  }, [boardId, editingWidgetIds, visibleLayoutWidgets]);

  /**
   * https://www.npmjs.com/package/react-grid-layout
   */
  return (
    <Wrapper className={deviceClassName}>
      <StyledContainer
        bg={background}
        className={`${deviceClassName}${
          deviceType === DeviceType.Mobile ? ' datart-mobile-board' : ''
        }`}
        ref={ref}
      >
        {deviceType === DeviceType.Mobile && (
          <MobilePreviewHeader>
            <LeftOutlined />
            <span>{name}</span>
          </MobilePreviewHeader>
        )}
        {visibleLayoutWidgets.length ? (
          <>
            <div className="grid-wrap" ref={gridWrapRef}>
              <ReactGridLayout
                layout={layoutMap[activeColsKey]}
                cols={LAYOUT_COLS_MAP[activeColsKey]}
                margin={curMargin}
                containerPadding={curPadding}
                rowHeight={widgetRowHeight}
                useCSSTransforms={true}
                measureBeforeMount={false}
                onResizeStop={changeWidgetLayouts}
                resizeHandles={['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw']}
                onDragStart={onPixelDragStart}
                onDrag={onPixelDrag}
                onDragStop={(...args: any[]) => {
                  clearPixelDrag();
                  changeWidgetLayouts(args[0]);
                }}
                isBounded={false}
                onLayoutChange={onLayoutChange}
                isDraggable={true}
                isResizable={true}
                allowOverlap={allowOverlap}
                draggableHandle={`.${WIDGET_DRAG_HANDLE}`}
              >
                {boardChildren}
              </ReactGridLayout>
            </div>
            {!!editingWidgetIds && <BoardOverlay />}
          </>
        ) : (
          <div className="empty">
            <Empty description="" />
          </div>
        )}
      </StyledContainer>
    </Wrapper>
  );
});

const Wrapper = styled.div<{}>`
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  width: 100px;
  min-height: 0;

  .react-resizable-handle {
    z-index: ${LEVEL_100};
  }

  /* DataEase 风格：保留右下角调整大小的命中区域，不显示三角形图标。 */
  .react-grid-item > .react-resizable-handle {
    width: 18px;
    height: 18px;
    padding: 0;
    background: transparent !important;
    background-image: none !important;
  }

  .react-grid-item > .react-resizable-handle::after {
    display: none;
  }

  &.desktop {
    min-width: 769px;
  }
`;

const StyledContainer = styled(StyledBackground)`
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;

  &.desktop {
    flex: 1;
    width: 100%;
  }

  &.mobile {
    flex: 0 0 auto;
    width: min(340px, calc(100% - 32px));
    height: calc(100% - 24px);
    min-height: 560px;
    margin: 12px auto;
    padding: 0;
    overflow: hidden;
    background: #edf4ff !important;
    border: 8px solid #1f2329;
    border-radius: 38px;
    box-shadow: 0 8px 28px rgb(31 35 41 / 22%);

    .grid-wrap {
      height: calc(100% - 44px);
      flex: 0 0 auto;
      overflow-y: auto;
      background: #edf4ff;
    }

    .react-grid-layout {
      min-height: 100%;
    }
  }

  .grid-wrap {
    flex: 1;
    overflow-y: auto;
    -ms-overflow-style: none;
  }

  .grid-wrap::-webkit-scrollbar {
    width: 0 !important;
  }

  .empty {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
  }
`;

const MobilePreviewHeader = styled.div`
  position: relative;
  z-index: 2;
  display: flex;
  flex: 0 0 44px;
  align-items: center;
  justify-content: center;
  background: #fff;
  color: #1f2329;
  font-size: 16px;

  .anticon {
    position: absolute;
    left: 16px;
    font-size: 18px;
  }

  span {
    max-width: calc(100% - 72px);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;
