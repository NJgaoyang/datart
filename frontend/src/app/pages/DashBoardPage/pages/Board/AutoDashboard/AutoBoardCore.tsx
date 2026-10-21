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

import { Empty } from 'antd';
import { useGridWidgetHeight } from 'app/hooks/useGridWidgetHeight';
import { BoardConfigValContext } from 'app/pages/DashBoardPage/components/BoardProvider/BoardConfigProvider';
import { BoardContext } from 'app/pages/DashBoardPage/components/BoardProvider/BoardProvider';
import { WidgetWrapProvider } from 'app/pages/DashBoardPage/components/WidgetProvider/WidgetWrapProvider';
import { LAYOUT_COLS_MAP } from 'app/pages/DashBoardPage/constants';
import useBoardScroll from 'app/pages/DashBoardPage/hooks/useBoardScroll';
import useGridLayoutMap from 'app/pages/DashBoardPage/hooks/useGridLayoutMap';
import useLayoutMap from 'app/pages/DashBoardPage/hooks/useLayoutMap';
import { getBoardMarginPadding } from 'app/pages/DashBoardPage/utils/board';
import { isMobileWidgetVisible } from 'app/pages/DashBoardPage/utils/autoLayout';
import { memo, useCallback, useContext, useMemo } from 'react';
import { DashboardGridLayout } from 'app/pages/DashBoardPage/components/GridLayout/DashboardGridLayout';
import styled from 'styled-components';
import StyledBackground from '../../../components/WidgetComponents/StyledBackground';
import { WidgetOfAuto } from './WidgetOfAuto';

export const AutoBoardCore: React.FC<{ boardId: string }> = memo(
  ({ boardId }) => {
    const { ref, widgetRowHeight, colsKey, canvasWidth } = useGridWidgetHeight(false);
    const { editing } = useContext(BoardContext);
    const boardConfig = useContext(BoardConfigValContext);
    const { background, allowOverlap, compactType } = boardConfig;

    const { curMargin, curPadding } = useMemo(() => {
      return getBoardMarginPadding(boardConfig, colsKey);
    }, [boardConfig, colsKey]);

    const { gridWrapRef, thEmitScroll } = useBoardScroll(boardId);

    const sortedLayoutWidgets = useLayoutMap(boardId);
    const visibleLayoutWidgets = useMemo(
      () => colsKey === 'sm'
        ? sortedLayoutWidgets.filter(isMobileWidgetVisible)
        : sortedLayoutWidgets,
      [colsKey, sortedLayoutWidgets],
    );
    const layoutMap = useGridLayoutMap(visibleLayoutWidgets);

    const onLayoutChange = useCallback(() => {
      thEmitScroll();
    }, [thEmitScroll]);

    // RGL v2 clones each direct child to inject its DOM ref, className and
    // positioning styles. The direct child MUST be a DOM node; only the
    // expensive widget contents are memoized.
    const boardChildren = useMemo(
      () => visibleLayoutWidgets.map(item => (
        <div key={item.id}>
          <ReadWidgetContent
            id={item.id}
            boardId={boardId}
            editing={editing}
          />
        </div>
      )),
      [boardId, editing, visibleLayoutWidgets],
    );
    return (
      <Wrapper>
        <StyledContainer className="dashboard-modern-canvas" bg={background}>
          <div className="grid-wrap" ref={gridWrapRef}>
            <div className="widget-row-height" ref={ref}>
              <DashboardGridLayout
                boardId={boardId}
                deviceKey={colsKey}
                measuredWidth={canvasWidth}
                layout={layoutMap[colsKey] || []}
                cols={LAYOUT_COLS_MAP[colsKey]}
                rowHeight={widgetRowHeight}
                margin={curMargin}
                containerPadding={curPadding}
                editable={false}
                allowOverlap={allowOverlap}
                compactType={compactType}
                onLayoutChange={onLayoutChange}
              >
                {boardChildren}
              </DashboardGridLayout>
            </div>
          </div>
          {!visibleLayoutWidgets.length && (
            <div className="empty">
              <Empty description="当前仪表板还没有可展示的组件" />
            </div>
          )}
        </StyledContainer>
      </Wrapper>
    );
  },
);

const Wrapper = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  min-height: 0;
`;
const StyledContainer = styled(StyledBackground)`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  .grid-wrap {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    overflow-x: auto;
    scrollbar-width: thin;
  }
  .grid-wrap::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  .empty {
    display: flex;
    flex: 100;
    align-items: center;
    justify-content: center;
  }
`;

/** Memoize chart contents, never the native DOM element RGL needs to control. */
const ReadWidgetContent = memo(
  ({ id, boardId, editing }: { id: string; boardId: string; editing: boolean }) => (
    <WidgetWrapProvider id={id} boardEditing={editing} boardId={boardId}>
      <WidgetOfAuto />
    </WidgetWrapProvider>
  ),
);
