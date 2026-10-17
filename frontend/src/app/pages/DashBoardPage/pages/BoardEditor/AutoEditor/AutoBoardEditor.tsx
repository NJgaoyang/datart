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
  MOBILE_ROW_HEIGHT,
} from 'app/pages/DashBoardPage/constants';
import useBoardScroll from 'app/pages/DashBoardPage/hooks/useBoardScroll';
import useEditAutoLayoutMap from 'app/pages/DashBoardPage/hooks/useEditAutoLayoutMap';
import useGridLayoutMap from 'app/pages/DashBoardPage/hooks/useGridLayoutMap';
import { DeviceType } from 'app/pages/DashBoardPage/pages/Board/slice/types';
import { getBoardMarginPadding } from 'app/pages/DashBoardPage/utils/board';
import { isMobileWidgetVisible } from 'app/pages/DashBoardPage/utils/autoLayout';
import { hasGridGeometryChanged } from 'app/pages/DashBoardPage/utils/gridLayout';
import { memo, useCallback, useContext, useMemo } from 'react';
import type { Layout } from 'react-grid-layout';
import { DashboardGridLayout } from 'app/pages/DashBoardPage/components/GridLayout/DashboardGridLayout';
import { useDispatch, useSelector } from 'react-redux';
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
  const { background, allowOverlap, compactType, showGrid } = boardConfig;
  const deviceType = useSelector(selectDeviceType);
  const editingWidgetIds = useSelector(selectEditingWidgetIds);
  // Only the explicit device switch may edit mobile geometry/visibility.
  const mobilePreview = deviceType === DeviceType.Mobile;
  const { ref, widgetRowHeight, colsKey: activeColsKey, canvasWidth } =
    useGridWidgetHeight(mobilePreview);
  const layoutDeviceType = deviceType;
  const { curMargin, curPadding } = useMemo(() => {
    return getBoardMarginPadding(boardConfig, activeColsKey);
  }, [activeColsKey, boardConfig]);

  const { gridWrapRef, thEmitScroll } = useBoardScroll(boardId);

  const sortedLayoutWidgets = useEditAutoLayoutMap(boardId);
  const visibleLayoutWidgets = useMemo(
    () =>
      activeColsKey === 'sm'
        ? sortedLayoutWidgets.filter(isMobileWidgetVisible)
        : sortedLayoutWidgets,
    [activeColsKey, sortedLayoutWidgets],
  );
  const layoutMap = useGridLayoutMap(visibleLayoutWidgets, canvasWidth, activeColsKey);

  // Keep pointer interactions in RGL; commit a single final layout after each gesture.
  const persistLayout = useCallback(
    (layouts: Layout) => {
      const previous = layoutMap[activeColsKey] || [];
      if (!hasGridGeometryChanged(previous, layouts)) return;
      // A gesture creates one persistent widget update / undo snapshot.
      // Live drag and resize previews are owned by RGL, not Redux.
      dispatch(
        editBoardStackActions.changeAutoBoardWidgetsRect({
          layouts,
          deviceType: layoutDeviceType,
        }),
      );
      dispatch(editDashBoardInfoActions.adjustDashLayouts(layouts));
      thEmitScroll();
    },
    [activeColsKey, layoutDeviceType, dispatch, layoutMap, thEmitScroll],
  );

  const onLayoutChange = useCallback(() => {
    // Do not dispatch Redux actions for every preview/collision frame.
    thEmitScroll();
  }, [thEmitScroll]);

  const { deviceClassName } = useMemo(() => {
    let deviceClassName: string = 'desktop';
    if (deviceType === DeviceType.Mobile) {
      deviceClassName = 'mobile';
    }
    return {
      deviceClassName,
    };
  }, [deviceType]);

  const editingIds = useMemo(
    () => new Set(editingWidgetIds.split(',').filter(Boolean)),
    [editingWidgetIds],
  );

  // RGL v2 clones direct children to inject ref/style/className. Keep a
  // native DOM grid cell so drag, resize and initial layout positioning work.
  const boardChildren = useMemo(
    () => visibleLayoutWidgets.map(item => (
      <div
        key={item.id}
        data-dashboard-widget-id={item.id}
        tabIndex={-1}
        style={{
          zIndex: editingIds.has(item.id)
            ? LEVEL_DASHBOARD_EDIT_OVERLAY + 1
            : 'auto',
        }}
      >
        <EditWidgetContent id={item.id} boardId={boardId} />
      </div>
    )),
    [boardId, editingIds, visibleLayoutWidgets],
  );

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
      >
        {deviceType === DeviceType.Mobile && (
          <MobilePreviewHeader>
            <LeftOutlined aria-hidden />
            <span>{name}</span>
          </MobilePreviewHeader>
        )}
        {visibleLayoutWidgets.length ? (
          <>
            <div className="grid-wrap" ref={gridWrapRef}>
              <div className="widget-row-height" ref={ref}>
              <DashboardGridLayout
                boardId={boardId}
                deviceKey={activeColsKey}
                measuredWidth={canvasWidth}
                layout={layoutMap[activeColsKey] || []}
                cols={LAYOUT_COLS_MAP[activeColsKey]}
                margin={curMargin}
                containerPadding={curPadding}
                rowHeight={
                  activeColsKey === 'sm' ? MOBILE_ROW_HEIGHT : widgetRowHeight
                }
                editable={true}
                allowOverlap={allowOverlap}
                compactType={compactType}
                showGrid={showGrid}
                onLayoutCommit={persistLayout}
                onLayoutChange={onLayoutChange}
              >
                {boardChildren}
              </DashboardGridLayout>
              </div>
            </div>
            {!!editingWidgetIds && <BoardOverlay />}
          </>
        ) : (
          <div className="empty">
            <Empty description="暂无组件，请使用顶部工具栏添加图表或筛选控件" />
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
  align-items: stretch;
  width: 100%;
  min-width: 0;
  min-height: 0;
  overflow: auto;

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
    min-width: 0;
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
    min-width: 0;
    overflow-y: auto;
    overflow-x: auto;
    scrollbar-width: thin;
  }

  &.mobile {
    /* One responsive mobile layout for every editor pane width.
       No phone presets, fixed preview width, or persisted breakpoints. */
    flex: 1 1 0;
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    min-height: 0;
    padding: 0;
    margin: 12px auto;
    overflow: hidden;
    background: #edf4ff !important;
    border: 8px solid #1f2329;
    border-radius: 38px;
    box-shadow: 0 8px 28px rgb(31 35 41 / 22%);

    .grid-wrap {
      flex: 1 1 0;
      min-height: 0;
      overflow-y: auto;
      background: #edf4ff;
    }

    .react-grid-layout {
      min-height: 100%;
    }
  }

  .grid-wrap::-webkit-scrollbar {
    width: 8px;
    height: 8px;
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
    flex: 1;
    margin: 0 8px 0 40px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

`;

/** Stable widget contents without swallowing the native RGL DOM props. */
const EditWidgetContent = memo(
  ({ id, boardId }: { id: string; boardId: string }) => (
    <WidgetWrapProvider id={id} boardEditing={true} boardId={boardId}>
      <WidgetOfAutoEditor />
    </WidgetWrapProvider>
  ),
);
