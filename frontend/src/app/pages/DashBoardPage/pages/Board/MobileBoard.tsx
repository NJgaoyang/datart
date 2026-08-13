/**
 * MobileBoard - 移动端仪表板视图（小程序风格）
 *
 * 移动端使用独立 6 列画布，按照组件 mRect 渲染。
 */
import { ArrowLeftOutlined } from '@ant-design/icons';
import { BoardLoading } from 'app/pages/DashBoardPage/components/BoardLoading';
import { BoardInitProvider } from 'app/pages/DashBoardPage/components/BoardProvider/BoardInitProvider';
import { FullScreenPanel } from 'app/pages/DashBoardPage/components/FullScreenPanel/FullScreenPanel';
import { WidgetMapper } from 'app/pages/DashBoardPage/components/WidgetMapper/WidgetMapper';
import { WidgetWrapProvider } from 'app/pages/DashBoardPage/components/WidgetProvider/WidgetWrapProvider';
import { MOBILE_GRID_COLS } from 'app/pages/DashBoardPage/constants';
import useLayoutMap from 'app/pages/DashBoardPage/hooks/useLayoutMap';
import { boardActions } from 'app/pages/DashBoardPage/pages/Board/slice';
import {
  makeSelectBoardConfigById,
  selectBoardWidgetMap,
} from 'app/pages/DashBoardPage/pages/Board/slice/selector';
import {
  fetchBoardDetail,
  renderedWidgetAsync,
} from 'app/pages/DashBoardPage/pages/Board/slice/thunk';
import {
  BoardState,
  RectConfig,
} from 'app/pages/DashBoardPage/pages/Board/slice/types';
import { cancelPendingWidgetFetches } from 'app/pages/DashBoardPage/pages/Board/slice/widgetDataBatcher';
import { Widget } from 'app/pages/DashBoardPage/types/widgetTypes';
import {
  isMobileWidgetVisible,
  normalizeAutoRectForCols,
} from 'app/pages/DashBoardPage/utils/autoLayout';
import {
  compactMobileLayout,
  getMobileGridSpan,
} from 'app/pages/DashBoardPage/utils/mobileLayout';
import { boardDrillManager } from 'app/pages/DashBoardPage/components/BoardDrillManager/BoardDrillManager';
import { dispatchResize } from 'app/utils/dispatchResize';
import { urlSearchTransfer } from 'utils/urlSearchTransfer';
import {
  MobileControlContext,
  MobileControlContextValue,
} from './MobileControlContext';
import { Button } from 'antd';
import React, {
  FC,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { SPACE } from 'styles/StyleConstants';

/** 模拟 PC 端 WidgetOfAuto 的包裹层样式，确保高度链正确传递 */
const WIDGET_INNER_STYLE: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  height: '100%',
};

const MOBILE_ROW_HEIGHT = 24;
const MOBILE_GAP = 2;
const MOBILE_PADDING = 4;
const MOBILE_TABLE_MIN_HEIGHT = 6;
const MOBILE_TABLE_MAX_VISIBLE_ROWS = 5;
const MOBILE_TABLE_INITIAL_HEIGHT = 16;
const MOBILE_TABLE_SCROLLBAR_HEIGHT = 8;
const MOBILE_TABLE_BOTTOM_GUARD = 2;
const MOBILE_DEFERRED_WIDGET_LOAD_MS = 300;
const TABLE_CHART_IDS = new Set(['react-table', 'fenzu-table', 'mingxi-table']);

const getNestedWidgetIds = (
  widget: Widget,
  widgetMap: Record<string, Widget>,
  visited = new Set<string>(),
): string[] => {
  if (!widget || visited.has(widget.id)) return [];
  visited.add(widget.id);

  const childIds = new Set<string>(widget.config.children || []);
  const tabItems = widget.config.content?.itemMap;
  if (tabItems) {
    Object.values(tabItems).forEach((item: any) => {
      if (item?.childWidgetId) childIds.add(item.childWidgetId);
    });
  }
  Object.values(widgetMap).forEach(child => {
    if (child.parentId === widget.id) childIds.add(child.id);
  });

  return [
    widget.id,
    ...[...childIds].flatMap(id =>
      getNestedWidgetIds(widgetMap[id], widgetMap, visited),
    ),
  ];
};

const getMobileRect = (widget: Widget): RectConfig => {
  const rect =
    widget.config.mRect ||
    (widget.config.pRect
      ? normalizeAutoRectForCols(widget.config.pRect, MOBILE_GRID_COLS)
      : { x: 0, y: 0, width: 1, height: 1 });
  const width = Math.max(
    1,
    Math.min(MOBILE_GRID_COLS, Math.round(Number(rect.width) || 1)),
  );
  const x = Math.max(
    0,
    Math.min(MOBILE_GRID_COLS - width, Math.round(Number(rect.x) || 0)),
  );

  return {
    ...rect,
    x,
    y: Math.max(0, Math.round(Number(rect.y) || 0)),
    width,
    height: Math.max(1, Math.round(Number(rect.height) || 1)),
  };
};

export interface MobileBoardProps {
  id: string;
  hideTitle?: boolean;
  filterSearchUrl?: string;
  allowDownload?: boolean;
  allowShare?: boolean;
  allowManage?: boolean;
}

export const MobileBoard: FC<MobileBoardProps> = memo(
  ({
    id,
    hideTitle,
    filterSearchUrl,
    allowDownload,
    allowShare,
    allowManage,
  }) => {
    const boardId = id;
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const wrapperRef = useRef<HTMLDivElement>(null);

    const dashboard = useSelector((state: { board: BoardState }) =>
      makeSelectBoardConfigById()(state, boardId),
    );

    const boardWidgetMap = useSelector((state: { board: BoardState }) =>
      selectBoardWidgetMap(state),
    );
    const boardDataChartMap = useSelector(
      (state: { board: BoardState }) => state.board.dataChartMap,
    );

    const searchParams = useMemo(() => {
      return filterSearchUrl
        ? urlSearchTransfer.toParams(filterSearchUrl)
        : undefined;
    }, [filterSearchUrl]);

    // 加载仪表板数据
    useEffect(() => {
      if (boardId) {
        dispatch(
          fetchBoardDetail({
            dashboardRelId: boardId,
            filterSearchParams: searchParams,
          }),
        );
      }
      return () => {
        dispatch(boardActions.clearBoardStateById(boardId));
        boardDrillManager.clearMapByBoardId(boardId);
        cancelPendingWidgetFetches(boardId);
      };
    }, [boardId, dispatch, searchParams]);

    const widgets = useLayoutMap(boardId);

    // 判断widgetRecord是否已加载完毕（有widget表示fetchBoardDetail已完成）
    const widgetRecordLoaded = useMemo(() => {
      const record = boardWidgetMap?.[boardId];
      return Boolean(record && Object.keys(record).length > 0);
    }, [boardWidgetMap, boardId]);

    const handleBack = () => {
      navigate(`/organizations/${dashboard?.orgId}/vizs`);
    };

    const viewBoard = useMemo(() => {
      if (!dashboard || !widgetRecordLoaded) return <BoardLoading />;

      return (
        <BoardInitProvider
          board={dashboard}
          editing={false}
          autoFit={true}
          renderMode="read"
          allowDownload={allowDownload}
          allowShare={allowShare}
          allowManage={allowManage}
        >
          <MobileBoardContent
            widgets={widgets}
            widgetMap={boardWidgetMap[boardId] || {}}
            dataChartMap={boardDataChartMap[boardId] || {}}
            boardId={boardId}
            boardName={dashboard.name}
            onBack={handleBack}
            wrapperRef={wrapperRef}
          />
        </BoardInitProvider>
      );
    }, [
      dashboard,
      widgetRecordLoaded,
      widgets,
      boardWidgetMap,
      boardDataChartMap,
      boardId,
      allowDownload,
      allowShare,
      allowManage,
    ]);

    return (
      <MobileWrapper ref={wrapperRef} className="datart-mobile-board">
        <DndProvider backend={HTML5Backend}>{viewBoard}</DndProvider>
      </MobileWrapper>
    );
  },
);

interface MobileBoardContentProps {
  widgets: Widget[];
  widgetMap: Record<string, Widget>;
  dataChartMap: BoardState['dataChartMap'][string];
  boardId: string;
  boardName: string;
  onBack: () => void;
  wrapperRef: React.RefObject<HTMLDivElement>;
}

const MobileBoardContent: FC<MobileBoardContentProps> = memo(
  ({
    widgets,
    widgetMap,
    dataChartMap,
    boardId,
    boardName,
    onBack,
    wrapperRef,
  }) => {
    const dispatch = useDispatch();
    const widgetDataMap = useSelector(
      (state: { board: BoardState }) => state.board.widgetDataMap,
    );
    const widgetRefs = useRef(new Map<string, HTMLDivElement>());
    const canvasRef = useRef<HTMLDivElement>(null);
    const mobileWidgets = useMemo(
      () =>
        widgets
          .filter(isMobileWidgetVisible)
          .map(widget => ({ widget, rect: getMobileRect(widget) }))
          .sort((a, b) => {
            if (a.rect.y !== b.rect.y) return a.rect.y - b.rect.y;
            if (a.rect.x !== b.rect.x) return a.rect.x - b.rect.x;
            return a.widget.config.index - b.widget.config.index;
          }),
      [widgets],
    );
    const hasTableDescendant = (widget: Widget) =>
      getNestedWidgetIds(widget, widgetMap).some(id =>
        TABLE_CHART_IDS.has(
          dataChartMap[widgetMap[id]?.datachartId]?.config?.chartGraphId,
        ),
      );
    const initialCompactHeights = useMemo(
      () =>
        Object.fromEntries(
          mobileWidgets
            .filter(({ widget }) => hasTableDescendant(widget))
            .map(({ widget }) => [widget.id, MOBILE_TABLE_INITIAL_HEIGHT]),
        ),
      [mobileWidgets, widgetMap, dataChartMap],
    );
    const [compactHeights, setCompactHeights] = useState<
      Record<string, number>
    >(initialCompactHeights);
    useEffect(() => {
      setCompactHeights(previous => {
        const next = { ...previous };
        Object.entries(initialCompactHeights).forEach(([id, height]) => {
          if (next[id] === undefined) next[id] = height;
        });
        return JSON.stringify(previous) === JSON.stringify(next)
          ? previous
          : next;
      });
    }, [initialCompactHeights]);
    const compactedMobileWidgets = useMemo(() => {
      const compactedRects = new Map(
        compactMobileLayout(
          mobileWidgets.map(({ widget, rect }) => ({ id: widget.id, rect })),
          compactHeights,
        ).map(item => [item.id, item.rect]),
      );
      return mobileWidgets.map(item => ({
        ...item,
        rect: compactedRects.get(item.widget.id) || item.rect,
      }));
    }, [compactHeights, mobileWidgets]);
    const mobileWidgetIds = useMemo(
      () => mobileWidgets.map(({ widget }) => widget.id).join(','),
      [mobileWidgets],
    );

    const measureTableHeights = useCallback(() => {
      setCompactHeights(previous => {
        // 未挂载完成的表格必须保留预留高度，不能用空结果覆盖。
        const next: Record<string, number> = {
          ...previous,
          ...initialCompactHeights,
        };
        mobileWidgets.forEach(({ widget }) => {
          const root = widgetRefs.current.get(widget.id);
          const table = [
            ...(root?.querySelectorAll<HTMLElement>('.ant-table-wrapper') ||
              []),
          ].find(candidate => {
            const header =
              candidate.querySelector<HTMLElement>('.ant-table-thead');
            return (header?.getBoundingClientRect().height || 0) > 0;
          });
          if (!root || !table) return;

          const tableTop =
            table.getBoundingClientRect().top -
            root.getBoundingClientRect().top;
          const sectionHeight = (selector: string) =>
            table.querySelector<HTMLElement>(selector)?.getBoundingClientRect()
              .height || 0;
          const headerHeight = sectionHeight('.ant-table-thead');
          // 非激活标签页的表格高度为 0，不能参与卡片收高计算。
          if (!headerHeight) return;
          const activeWidgetId = table.closest<HTMLElement>(
            '[data-datart-widget-id]',
          )?.dataset.datartWidgetId;
          const activeDataset = activeWidgetId
            ? widgetDataMap[activeWidgetId]
            : undefined;
          // 数据未加载完成时保留五行预留高度，禁止根据临时 DOM 行数收高。
          if (!activeDataset) return;
          const dataRows = activeDataset.rows?.length || 0;
          const visibleRowCount = Math.min(
            MOBILE_TABLE_MAX_VISIBLE_ROWS,
            Math.max(0, dataRows),
          );
          const firstDataRow = table.querySelector<HTMLElement>(
            '.ant-table-tbody > tr.ant-table-row',
          );
          // 有数据但数据行尚未完成挂载时不能收高，等待下一次 DOM 变更。
          if (dataRows > 0 && !firstDataRow) return;
          const rowHeight =
            firstDataRow?.getBoundingClientRect().height || headerHeight;
          const contentHeight =
            headerHeight +
            rowHeight * visibleRowCount +
            MOBILE_TABLE_SCROLLBAR_HEIGHT +
            sectionHeight('.ant-table-summary') +
            sectionHeight('.ant-table-footer') +
            sectionHeight('.ant-pagination');
          // 只能按目标可视行数计算。读取当前表格底部会把尚未受约束的
          // 全部数据行反向写回卡片高度，形成越测越高的循环。
          const requiredHeight = tableTop + contentHeight;
          const rows = getMobileGridSpan(
            requiredHeight,
            MOBILE_ROW_HEIGHT,
            MOBILE_GAP,
            MOBILE_TABLE_MIN_HEIGHT,
            MOBILE_TABLE_BOTTOM_GUARD,
          );
          next[widget.id] = rows;
        });
        return JSON.stringify(previous) === JSON.stringify(next)
          ? previous
          : next;
      });
    }, [initialCompactHeights, mobileWidgets, widgetDataMap]);

    // 标签卡子组件是异步挂载的，监听真实 DOM 出现和数据行变化后再测量。
    useLayoutEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      let frame = requestAnimationFrame(measureTableHeights);
      const scheduleMeasure = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(measureTableHeights);
      };
      const mutationObserver = new MutationObserver(scheduleMeasure);
      mutationObserver.observe(canvas, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class'],
      });
      const resizeObserver = new ResizeObserver(scheduleMeasure);
      widgetRefs.current.forEach(element => resizeObserver.observe(element));
      return () => {
        cancelAnimationFrame(frame);
        mutationObserver.disconnect();
        resizeObserver.disconnect();
      };
    }, [measureTableHeights, mobileWidgetIds]);

    // 卡片高度提交后统一同步一次图表尺寸。表格自身不再参与高度计算。
    useLayoutEffect(() => {
      const frame = requestAnimationFrame(dispatchResize);
      return () => cancelAnimationFrame(frame);
    }, [compactHeights]);

    // 优先加载首屏组件，避免屏幕外图表与首屏表格争抢同一个批量查询。
    // 其余组件紧接着加载，滚动到下方时不会出现空白。
    useEffect(() => {
      if (!mobileWidgets.length) return;
      const viewportHeight =
        wrapperRef.current?.clientHeight || window.innerHeight;
      const viewportRows = Math.ceil(
        viewportHeight / (MOBILE_ROW_HEIGHT + MOBILE_GAP),
      );
      const initialWidgets = mobileWidgets.filter(
        ({ rect }) => rect.y < viewportRows,
      );
      const firstScreenWidgets = initialWidgets.length
        ? initialWidgets
        : mobileWidgets.slice(0, 1);
      const initialWidgetIds = new Set(
        firstScreenWidgets.map(({ widget }) => widget.id),
      );
      const remainingWidgets = mobileWidgets.filter(
        ({ widget }) => !initialWidgetIds.has(widget.id),
      );
      const renderWidgets = (items: typeof mobileWidgets) => {
        items.forEach(({ widget: w }) => {
          dispatch(
            renderedWidgetAsync({
              boardId,
              widgetId: w.id,
              renderMode: 'read',
            }),
          );
        });
      };

      renderWidgets(firstScreenWidgets);
      const timer = window.setTimeout(
        () => renderWidgets(remainingWidgets),
        MOBILE_DEFERRED_WIDGET_LOAD_MS,
      );
      return () => window.clearTimeout(timer);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [boardId, mobileWidgetIds]);

    // 移动端：将筛选器弹窗挂载到 MobileWrapper，避免被窄容器裁剪
    const mobileControlValue: MobileControlContextValue = useMemo(
      () => ({
        getPopupContainer: () => wrapperRef.current || document.body,
      }),
      [wrapperRef],
    );

    return (
      <PageWrapper>
        {/* 顶部导航栏 */}
        <NavBar>
          <BackBtn type="text" icon={<ArrowLeftOutlined />} onClick={onBack} />
          <NavTitle>{boardName}</NavTitle>
          <NavSpacer />
        </NavBar>

        <ScrollBody>
          <MobileControlContext.Provider value={mobileControlValue}>
            <MobileCanvas ref={canvasRef}>
              {compactedMobileWidgets.map(({ widget, rect }) => (
                <MobileWidget
                  key={widget.id}
                  className="mobile-widget"
                  rect={rect}
                  ref={element => {
                    if (element) widgetRefs.current.set(widget.id, element);
                    else widgetRefs.current.delete(widget.id);
                  }}
                >
                  <WidgetWrapProvider
                    id={widget.id}
                    boardEditing={false}
                    boardId={boardId}
                  >
                    <div className="widget" style={WIDGET_INNER_STYLE}>
                      <WidgetMapper boardEditing={false} hideTitle={false} />
                    </div>
                  </WidgetWrapProvider>
                </MobileWidget>
              ))}
            </MobileCanvas>
          </MobileControlContext.Provider>
          <BottomSafe />
        </ScrollBody>

        {/* 全屏面板 */}
        <FullScreenPanel />
      </PageWrapper>
    );
  },
);

/* ========== 外层容器：填充父级 ========== */
/* 不使用 overflow:hidden，否则 antd Select 下拉会被裁剪 */
const MobileWrapper = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  background-color: #f5f5f5;
`;

/* ========== 页面布局：导航栏 + 可滚动主体 ========== */
const PageWrapper = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
`;

/* ========== 顶部导航栏：类似小程序 navigationBar ========== */
const NavBar = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  min-height: 40px;
  padding: 0 ${SPACE}px;
  padding-top: calc(env(safe-area-inset-top, 0px) + 0px);
  background-color: #fff;
  box-sizing: content-box;

  /* 细分割线 */
  &::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 0.5px;
    background-color: rgba(0, 0, 0, 0.08);
  }
`;

const NavTitle = styled.h1`
  flex: 1;
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1a;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 40px;
`;

const NavSpacer = styled.div`
  width: 28px;
  flex-shrink: 0;
`;

const BackBtn = styled(Button)`
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  padding: 0;
  font-size: 16px;
  color: #333;
`;

/* ========== 可滚动主体 ========== */
const ScrollBody = styled.div`
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  padding: 0;
  font-size: 13px;
`;

/* ========== DataEase 风格移动端画布 ========== */
const MobileCanvas = styled.div`
  position: relative;
  display: grid;
  grid-template-columns: repeat(${MOBILE_GRID_COLS}, minmax(0, 1fr));
  grid-auto-rows: ${MOBILE_ROW_HEIGHT}px;
  gap: ${MOBILE_GAP}px;
  align-content: start;
  min-height: 100%;
  padding: ${MOBILE_PADDING}px;
  box-sizing: border-box;
  background: #edf4ff;

  .mobile-widget {
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgb(31 35 41 / 12%);
  }

  .mobile-widget > .widget,
  .mobile-widget .widget > div {
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    padding: 0 !important;
    border: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
  }

  .ant-select,
  .ant-picker {
    width: 100%;
  }

  .ant-select-selector,
  .ant-picker-input > input {
    font-size: 16px;
  }

  .ant-select-multiple .ant-select-selection-overflow {
    max-height: 36px;
    overflow: hidden;
    flex-wrap: nowrap !important;
  }

  .ant-table-wrapper {
    max-width: 100%;
    overflow: hidden;
  }
`;

const MobileWidget = styled.div<{ rect: RectConfig }>`
  grid-column: ${p => `${p.rect.x + 1} / span ${p.rect.width}`};
  grid-row: ${p => `${p.rect.y + 1} / span ${p.rect.height}`};
`;

/* ========== 底部安全区占位 ========== */
const BottomSafe = styled.div`
  height: env(safe-area-inset-bottom, 16px);
  min-height: 16px;
`;
