/**
 * Native react-grid-layout v2 layout shell for automatic dashboards.
 *
 * This is a new-system component: all coordinates use RGL v2 Layout and
 * any import of old dashboard data belongs in the future migration service.
 */
import { memo, useMemo, type ReactNode, type RefObject } from 'react';
import styled from 'styled-components';
import {
  GridLayout,
  useContainerWidth,
  type Layout,
} from 'react-grid-layout';
import { getCompactor } from 'react-grid-layout/core';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import { WIDGET_DRAG_HANDLE } from '../../constants';
import { getResponsiveGridSpacing } from '../../utils/gridSpacing';
import { getGridGuideStyle, resolveGridCompactType } from '../../utils/gridEngineOptions';

const ALL_RESIZE_HANDLES = [
  'n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw',
] as const;

export interface DashboardGridLayoutProps {
  boardId: string;
  deviceKey: string;
  layout: Layout;
  cols: number;
  rowHeight: number;
  margin: [number, number];
  containerPadding: [number, number];
  allowOverlap: boolean;
  compactType?: 'vertical' | 'horizontal' | 'none';
  showGrid?: boolean;
  editable: boolean;
  onLayoutChange?: (layout: Layout) => void;
  onLayoutCommit?: (layout: Layout) => void;
  children: ReactNode;
}

/** Share the same positioning engine in read and edit modes. */
export const DashboardGridLayout = memo(
  ({
    boardId,
    deviceKey,
    layout,
    cols,
    rowHeight,
    margin,
    containerPadding,
    allowOverlap,
    compactType = 'vertical',
    showGrid = false,
    editable,
    onLayoutChange,
    onLayoutCommit,
    children,
  }: DashboardGridLayoutProps) => {
    const { width, containerRef, mounted } = useContainerWidth({
      measureBeforeMount: true,
    });
    const gridConfig = useMemo(
      () => ({
        cols,
        rowHeight,
        ...getResponsiveGridSpacing({
          width,
          cols,
          margin,
          containerPadding,
        }),
      }),
      [width, cols, rowHeight, margin, containerPadding],
    );
    const dragConfig = useMemo(
      () => ({
        enabled: editable,
        bounded: false,
        handle: `.${WIDGET_DRAG_HANDLE}`,
        threshold: 3,
      }),
      [editable],
    );
    const resizeConfig = useMemo(
      () => ({
        enabled: editable,
        handles: ALL_RESIZE_HANDLES,
      }),
      [editable],
    );
    const compactor = useMemo(
      () => getCompactor(resolveGridCompactType(compactType), allowOverlap),
      [compactType, allowOverlap],
    );
    const guideStyle = useMemo(
      () => editable && showGrid
        ? getGridGuideStyle(width, gridConfig)
        : undefined,
      [editable, showGrid, width, gridConfig],
    );

    return (
      <MeasuredGridShell
        className={editable ? 'datart-grid-width editing' : 'datart-grid-width reading'}
        ref={containerRef as RefObject<HTMLDivElement>}
        style={{ width: '100%', minWidth: 0 }}
      >
        {mounted && width > 0 && (
          <GridLayout
            key={`${boardId}:${deviceKey}:${editable ? 'edit' : 'read'}`}
            width={width}
            layout={layout}
            style={guideStyle}
            gridConfig={gridConfig}
            dragConfig={dragConfig}
            resizeConfig={resizeConfig}
            compactor={compactor}
            onDragStop={editable ? onLayoutCommit : undefined}
            onResizeStop={editable ? onLayoutCommit : undefined}
            onLayoutChange={onLayoutChange}
          >
            {children}
          </GridLayout>
        )}
      </MeasuredGridShell>
    );
  },
);

const MeasuredGridShell = styled.div`
  /* Browser skips paint/layout work for offscreen chart content without
     unmounting it (which would break data subscriptions or export flows). */
  &.reading .react-grid-item > div {
    content-visibility: auto;
    contain-intrinsic-size: auto 240px;
  }
`;
