/**
 * MobileBoard - 移动端仪表板视图（小程序风格）
 *
 * 设计参考微信小程序数据报表：
 * - 卡片式布局，图表独立白色卡片
 * - 筛选器置顶，交互自然
 * - 自适应所有手机屏幕（320px ~ 428px+）
 * - 支持安全区域（刘海屏、底部指示条）
 * - 流畅的原生级滚动体验
 */
import { ArrowLeftOutlined } from '@ant-design/icons';
import { BoardLoading } from 'app/pages/DashBoardPage/components/BoardLoading';
import { BoardInitProvider } from 'app/pages/DashBoardPage/components/BoardProvider/BoardInitProvider';
import { FullScreenPanel } from 'app/pages/DashBoardPage/components/FullScreenPanel/FullScreenPanel';
import { WidgetMapper } from 'app/pages/DashBoardPage/components/WidgetMapper/WidgetMapper';
import { WidgetWrapProvider } from 'app/pages/DashBoardPage/components/WidgetProvider/WidgetWrapProvider';
import { ORIGINAL_TYPE_MAP } from 'app/pages/DashBoardPage/constants';
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
import { BoardState } from 'app/pages/DashBoardPage/pages/Board/slice/types';
import { cancelPendingWidgetFetches } from 'app/pages/DashBoardPage/pages/Board/slice/widgetDataBatcher';
import { Widget } from 'app/pages/DashBoardPage/types/widgetTypes';
import { boardDrillManager } from 'app/pages/DashBoardPage/components/BoardDrillManager/BoardDrillManager';
import { urlSearchTransfer } from 'utils/urlSearchTransfer';
import {
  MobileControlContext,
  MobileControlContextValue,
} from './MobileControlContext';
import { Button } from 'antd';
import React, { FC, memo, useEffect, useMemo, useRef } from 'react';
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

const CONTROLLER_ORIGINAL_TYPES: Set<string> = new Set([
  ORIGINAL_TYPE_MAP.dropdownList,
  ORIGINAL_TYPE_MAP.multiDropdownList,
  ORIGINAL_TYPE_MAP.checkboxGroup,
  ORIGINAL_TYPE_MAP.radioGroup,
  ORIGINAL_TYPE_MAP.text,
  ORIGINAL_TYPE_MAP.time,
  ORIGINAL_TYPE_MAP.rangeTime,
  ORIGINAL_TYPE_MAP.rangeValue,
  ORIGINAL_TYPE_MAP.value,
  ORIGINAL_TYPE_MAP.slider,
  ORIGINAL_TYPE_MAP.dropDownTree,
]);

const BUTTON_ORIGINAL_TYPES: Set<string> = new Set([
  ORIGINAL_TYPE_MAP.queryBtn,
  ORIGINAL_TYPE_MAP.resetBtn,
]);

/** 排序：控制器 → 按钮 → 图表/媒体 → 容器 */
function sortWidgetsForMobile(widgets: Widget[]): Widget[] {
  return [...widgets].sort((a, b) => {
    const typeA = a.config.originalType;
    const typeB = b.config.originalType;
    const rankA = CONTROLLER_ORIGINAL_TYPES.has(typeA) ? 0
      : BUTTON_ORIGINAL_TYPES.has(typeA) ? 1 : 2;
    const rankB = CONTROLLER_ORIGINAL_TYPES.has(typeB) ? 0
      : BUTTON_ORIGINAL_TYPES.has(typeB) ? 1 : 2;
    if (rankA !== rankB) return rankA - rankB;
    return a.config.index - b.config.index;
  });
}

export interface MobileBoardProps {
  id: string;
  hideTitle?: boolean;
  filterSearchUrl?: string;
  allowDownload?: boolean;
  allowShare?: boolean;
  allowManage?: boolean;
}

export const MobileBoard: FC<MobileBoardProps> = memo(
  ({ id, hideTitle, filterSearchUrl, allowDownload, allowShare, allowManage }) => {
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

    // 获取排序后的 widgets
    const sortedLayoutWidgets = useLayoutMap(boardId);
    const mobileSortedWidgets = useMemo(
      () => sortWidgetsForMobile(sortedLayoutWidgets),
      [sortedLayoutWidgets],
    );

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
            widgets={mobileSortedWidgets}
            boardId={boardId}
            boardName={dashboard.name}
            onBack={handleBack}
            wrapperRef={wrapperRef}
          />
        </BoardInitProvider>
      );
    }, [dashboard, widgetRecordLoaded, mobileSortedWidgets, boardId, allowDownload, allowShare, allowManage]);

    return (
      <MobileWrapper ref={wrapperRef}>
        <DndProvider backend={HTML5Backend}>{viewBoard}</DndProvider>
      </MobileWrapper>
    );
  },
);

interface MobileBoardContentProps {
  widgets: Widget[];
  boardId: string;
  boardName: string;
  onBack: () => void;
  wrapperRef: React.RefObject<HTMLDivElement>;
}

const MobileBoardContent: FC<MobileBoardContentProps> = memo(
  ({ widgets, boardId, boardName, onBack, wrapperRef }) => {
    const dispatch = useDispatch();

    const filterWidgets = useMemo(
      () =>
        widgets.filter(w =>
          CONTROLLER_ORIGINAL_TYPES.has(w.config.originalType),
        ),
      [widgets],
    );
    const buttonWidgets = useMemo(
      () =>
        widgets.filter(w =>
          BUTTON_ORIGINAL_TYPES.has(w.config.originalType),
        ),
      [widgets],
    );
    const chartWidgets = useMemo(
      () =>
        widgets.filter(
          w =>
            !CONTROLLER_ORIGINAL_TYPES.has(w.config.originalType) &&
            !BUTTON_ORIGINAL_TYPES.has(w.config.originalType),
        ),
      [widgets],
    );

    const hasFilters = filterWidgets.length > 0;
    const hasButtons = buttonWidgets.length > 0;
    const hasQueryBtn = buttonWidgets.some(
      w => w.config.originalType === ORIGINAL_TYPE_MAP.queryBtn,
    );

    // 移动端直接触发所有 widget 的数据加载
    // PC 端靠 boardScroll + isElView 懒加载，移动端不走这套机制
    // 用 setTimeout 确保 fetchBoardDetail 的同步 action 已全部写入 Redux store
    useEffect(() => {
      if (!widgets.length) return;
      const timer = setTimeout(() => {
        widgets.forEach(w => {
          dispatch(
            renderedWidgetAsync({
              boardId,
              widgetId: w.id,
              renderMode: 'read',
            }),
          );
        });
      }, 50);
      return () => clearTimeout(timer);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [boardId, widgets.length]);

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
          <BackBtn
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={onBack}
          />
          <NavTitle>{boardName}</NavTitle>
          <NavSpacer />
        </NavBar>

        <ScrollBody>
          {/* 筛选器卡片 */}
          {hasFilters && (
            <MobileControlContext.Provider value={mobileControlValue}>
              <FilterCard>
                <FilterGrid>
                  {filterWidgets.map(widget => (
                    <FilterCell key={widget.id}>
                      <WidgetWrapProvider
                        id={widget.id}
                        boardEditing={false}
                        boardId={boardId}
                      >
                        <WidgetMapper boardEditing={false} hideTitle={false} />
                      </WidgetWrapProvider>
                    </FilterCell>
                  ))}
                </FilterGrid>

                {/* 按钮行 */}
                {hasButtons && (
                  <ButtonRow>
                    {buttonWidgets.map(widget => (
                      <WidgetWrapProvider
                        key={widget.id}
                        id={widget.id}
                        boardEditing={false}
                        boardId={boardId}
                      >
                        <WidgetMapper boardEditing={false} hideTitle={false} />
                      </WidgetWrapProvider>
                    ))}
                  </ButtonRow>
                )}

                {/* 查询提示 */}
                {hasQueryBtn && hasFilters && (
                  <FilterHint>
                    调整筛选后，请点击「查询」加载数据
                  </FilterHint>
                )}
              </FilterCard>
            </MobileControlContext.Provider>
          )}

          {/* 图表卡片列表 */}
          {chartWidgets.map(widget => (
            <ChartCard key={widget.id}>
              <WidgetWrapProvider
                id={widget.id}
                boardEditing={false}
                boardId={boardId}
              >
                <div className="widget" style={WIDGET_INNER_STYLE}>
                  <WidgetMapper boardEditing={false} hideTitle={false} />
                </div>
              </WidgetWrapProvider>
            </ChartCard>
          ))}

          {/* 底部安全区占位 */}
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
  padding: 10px 10px 0;
  font-size: 13px;
`;

/* ========== 筛选器卡片 ========== */
const FilterCard = styled.div`
  position: relative;
  z-index: 10;
  margin-bottom: 10px;
  padding: 10px 12px 8px;
  background-color: #fff;
  border-radius: 10px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);

  /* 筛选器表单标签字号 */
  .ant-form-item-label > label {
    font-size: 12px;
    height: 22px;
  }

  .ant-form-item {
    margin-bottom: 4px;
  }

  /* 限制多选标签区域高度，防止选项过多撑开卡片 */
  .ant-select-multiple .ant-select-selection-item {
    height: 22px !important;
    line-height: 20px !important;
    font-size: 12px !important;
    margin-top: 2px !important;
  }
`;

const FilterGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 12px;

  @media (max-width: 360px) {
    grid-template-columns: 1fr;
  }
`;

const FilterCell = styled.div`
  min-width: 0;
  overflow: hidden;

  /* 固定筛选器单元格高度，多选/日期等控件不会撑开 */
  max-height: 72px;
  display: flex;
  align-items: flex-start;

  /* 去除 WidgetWrapper 卡片外观 */
  > div {
    background: none !important;
    border: none !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    padding: 0 !important;
    min-height: unset !important;
    width: 100%;
  }

  .widget {
    height: auto;
    min-height: unset;
    overflow: hidden;
  }

  /* 筛选控件撑满 */
  .ant-select,
  .ant-picker {
    width: 100%;
  }

  /* 控件字体：iOS Safari 要求 >=16px 才不自动缩放 */
  .ant-select-selector,
  .ant-picker-input > input {
    font-size: 16px;
  }

  /* 多选标签区域：单行显示，超出隐藏 */
  .ant-select-multiple .ant-select-selection-overflow {
    max-height: 36px;
    overflow: hidden;
    flex-wrap: nowrap !important;
  }
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #f0f0f0;

  .widget {
    height: auto;
    min-height: unset;
  }

  /* 按钮移动端缩小 */
  .ant-btn {
    font-size: 13px;
    height: 32px;
    padding: 4px 12px;
    border-radius: 6px;
  }
`;

const FilterHint = styled.div`
  margin-top: 6px;
  font-size: 11px;
  color: #bbb;
  text-align: center;
`;

/* ========== 图表卡片 ========== */
const ChartCard = styled.div`
  position: relative;
  margin-bottom: 10px;
  border-radius: 10px;
  background-color: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  overflow: hidden;

  /* 强制设置高度，确保 useCacheWidthHeight 能测量到有效尺寸 */
  /* DataChartWidgetCore 在 cacheW<=1 || cacheH<=1 时返回 null 不渲染图表 */
  .widget {
    height: 280px !important;
    min-height: 280px !important;
    max-height: 280px !important;
    padding: 4px 0;
  }

  /* 覆盖 WidgetWrapper 默认的 min-height: 0 */
  .widget > div {
    min-height: unset !important;
    height: 100% !important;
  }

  &:active {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
`;

/* ========== 底部安全区占位 ========== */
const BottomSafe = styled.div`
  height: env(safe-area-inset-bottom, 16px);
  min-height: 16px;
`;
