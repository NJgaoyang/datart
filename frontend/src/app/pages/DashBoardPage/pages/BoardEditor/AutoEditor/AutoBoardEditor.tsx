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
import { memo, useCallback, useContext, useMemo } from 'react';
import { GridLayout, type Layout, useContainerWidth, verticalCompactor } from 'react-grid-layout';
import { noOverlapCompactor } from 'react-grid-layout/core';
import 'react-grid-layout/css/styles.css';
import { useDispatch, useSelector } from 'react-redux';
import 'react-resizable/css/styles.css';
import styled from 'styled-components';
import { LEVEL_100, LEVEL_DASHBOARD_EDIT_OVERLAY } from 'styles/StyleConstants';
import BoardOverlay from '../components/BoardOverlay';
import { editBoardStackActions, editDashBoardInfoActions } from '../slice';
import { selectDeviceType, selectEditingWidgetIds } from '../slice/selectors';
import { WidgetOfAutoEditor } from './WidgetOfAutoEditor';

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

  const { gridWrapRef, thEmitScroll } = useBoardScroll(boardId);
  const { width: gridWidth, containerRef, mounted } = useContainerWidth({
    measureBeforeMount: true,
  });

  const sortedLayoutWidgets = useEditAutoLayoutMap(boardId);
  const visibleLayoutWidgets = useMemo(
    () =>
      deviceType === DeviceType.Mobile
        ? sortedLayoutWidgets.filter(isMobileWidgetVisible)
        : sortedLayoutWidgets,
    [deviceType, sortedLayoutWidgets],
  );
  const layoutMap = useGridLayoutMap(visibleLayoutWidgets);

  // Keep pointer interactions in RGL; commit a single final layout after each gesture.
  const persistLayout = useCallback(
    (layouts: Layout) => {
      const previous = layoutMap[activeColsKey] || [];
      if (
        previous.length === layouts.length &&
        layouts.every(item => {
          const old = previous.find(candidate => candidate.i === item.i);
          return (
            old &&
            old.x === item.x &&
            old.y === item.y &&
            old.w === item.w &&
            old.h === item.h
          );
        })
      ) {
        return;
      }
      dispatch(
        editBoardStackActions.changeAutoBoardWidgetsRect({
          layouts,
          deviceType,
        }),
      );
    },
    [activeColsKey, deviceType, dispatch, layoutMap],
  );

  const onLayoutChange = useCallback(
    (layouts: Layout) => {
      thEmitScroll();
      dispatch(editDashBoardInfoActions.adjustDashLayouts(layouts));
    },
    [dispatch, thEmitScroll],
  );

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
              <div className="grid-width" ref={containerRef}>
                {mounted && gridWidth > 0 && (
                  <GridLayout
                    width={gridWidth}
                    layout={layoutMap[activeColsKey] || []}
                    gridConfig={{
                      cols: LAYOUT_COLS_MAP[activeColsKey],
                      margin: curMargin,
                      containerPadding: curPadding,
                      rowHeight: widgetRowHeight,
                    }}
                    dragConfig={{
                      enabled: true,
                      bounded: false,
                      handle: `.${WIDGET_DRAG_HANDLE}`,
                      threshold: 3,
                    }}
                    resizeConfig={{
                      enabled: true,
                      handles: ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'],
                    }}
                    compactor={
                      allowOverlap ? noOverlapCompactor : verticalCompactor
                    }
                    onResizeStop={persistLayout}
                    onDragStop={persistLayout}
                    onLayoutChange={onLayoutChange}
                  >
                    {boardChildren}
                  </GridLayout>
                )}
              </div>
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

  .grid-wrap {
    flex: 1;
    overflow-y: auto;
    -ms-overflow-style: none;
  }

  &.mobile {
    flex: 0 0 auto;
    width: min(340px, calc(100% - 32px));
    height: calc(100% - 24px);
    min-height: 560px;
    padding: 0;
    margin: 12px auto;
    overflow: hidden;
    background: #edf4ff !important;
    border: 8px solid #1f2329;
    border-radius: 38px;
    box-shadow: 0 8px 28px rgb(31 35 41 / 22%);

    .grid-wrap {
      flex: 0 0 auto;
      height: calc(100% - 44px);
      overflow-y: auto;
      background: #edf4ff;
    }

    .react-grid-layout {
      min-height: 100%;
    }
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
  font-size: 16px;
  color: #1f2329;
  background: #fff;

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
