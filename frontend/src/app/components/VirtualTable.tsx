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

import { Empty, Table, TableProps } from 'antd';
import classNames from 'classnames';
import React, {
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { VariableSizeGrid as Grid } from 'react-window';
import styled from 'styled-components';
import { SPACE_TIMES } from 'styles/StyleConstants';

interface VirtualTableProps extends TableProps<object> {
  width: number;
  scroll: { x: number; y: number };
  columns: any;
}

type VirtualGridRef = {
  state?: { scrollLeft?: number };
  resetAfterIndices: (options: {
    columnIndex: number;
    shouldForceUpdate: boolean;
  }) => void;
  scrollToItem: (options: { columnIndex: number; align: 'start' }) => void;
  scrollTo: (options: { scrollLeft: number }) => void;
};

export function stabilizeVirtualGridWidth(
  grid: VirtualGridRef | undefined,
  columnCount: number,
) {
  if (!grid) return;
  const scrollLeft = grid.state?.scrollLeft || 0;
  grid.resetAfterIndices({
    columnIndex: 0,
    shouldForceUpdate: false,
  });
  // VariableSizeGrid otherwise estimates unvisited columns at 50px, changing the scrollbar while users drag.
  grid.scrollToItem({ columnIndex: Math.max(0, columnCount - 1), align: 'start' });
  grid.scrollTo({ scrollLeft });
}

/**
 * Table组件中使用了虚拟滚动条 渲染的速度变快 基于（react-windows）
 * 使用方法：import { VirtualTable } from 'app/components/VirtualTable';
 * <VirtualTable
    dataSource={dataSourceWithKey}
    columns={columns}
    width={width}
    ...tableProps
  />
 */
export const VirtualTable = memo((props: VirtualTableProps) => {
  const { columns, scroll, width: boxWidth, dataSource } = props;
  const gridRef: any = useRef(undefined);
  const [connectObject] = useState(() => {
    const obj = {};
    Object.defineProperty(obj, 'scrollLeft', {
      get: () => 0,
      set: scrollLeft => {
        if (gridRef.current) {
          gridRef.current.scrollTo({
            scrollLeft,
          });
        }
      },
    });
    return obj;
  });
  // A wider preview pane should reveal blank space, not stretch every
  // measured data column. The same widths drive AntD's header and the grid.
  const mergedColumns = useMemo(
    () =>
      columns.map(column => ({
        ...column,
        width: Number(column.width) > 0 ? Number(column.width) : 120,
      })),
    [columns],
  );
  const contentWidth = mergedColumns.reduce(
    (total, column) => total + column.width,
    0,
  );
  const columnWidthSignature = mergedColumns.map(column => column.width).join(',');

  const resetVirtualGrid = useCallback(() => {
    stabilizeVirtualGridWidth(gridRef.current, mergedColumns.length);
  }, [mergedColumns.length]);

  useLayoutEffect(() => {
    resetVirtualGrid();
  }, [boxWidth, columnWidthSignature, resetVirtualGrid]);

  const renderVirtualList = useCallback(
    (rawData, { scrollbarSize, ref, onScroll }) => {
      ref.current = connectObject;
      const totalHeight = rawData.length * 40;
      const safeHeight = Math.max(scroll.y, 1);

      if (!dataSource?.length) {
        //If the data is empty
        return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />;
      }

      return (
        <Grid
          ref={gridRef}
          className="virtual-grid"
          columnCount={mergedColumns.length}
          columnWidth={index => {
            const { width } = mergedColumns[index];
            return totalHeight > safeHeight &&
              index === mergedColumns.length - 1
              ? Math.max(48, width - scrollbarSize - 16)
              : width;
          }}
          height={safeHeight}
          rowCount={rawData.length}
          rowHeight={() => 40}
          width={boxWidth}
          onScroll={({ scrollLeft }) => {
            onScroll({
              scrollLeft,
            });
          }}
        >
          {({ rowIndex, columnIndex, style }) => {
            style = {
              padding: `0 ${SPACE_TIMES(2)}`,
              textAlign: mergedColumns[columnIndex].align,
              ...style,
            };
            return (
              <TableCell
                className={classNames('virtual-table-cell', {
                  'virtual-table-cell-last':
                    columnIndex === mergedColumns.length - 1,
                })}
                style={style}
                key={columnIndex}
              >
                {rawData[rowIndex][mergedColumns[columnIndex].dataIndex]}
              </TableCell>
            );
          }}
        </Grid>
      );
    },
    [mergedColumns, boxWidth, connectObject, dataSource, scroll],
  );

  return (
    <VirtualTableShell $contentWidth={contentWidth}>
      <Table
        {...props}
        scroll={{ ...scroll, x: contentWidth }}
        columns={mergedColumns}
        components={{
          body: renderVirtualList,
          ...props.components,
        }}
      />
    </VirtualTableShell>
  );
});

const TableCell = styled.div`
  display: flex;
  align-items: center;
  box-sizing: border-box;
  min-width: 0;
  padding: 0 ${SPACE_TIMES(2)};
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  border-bottom: 1px solid ${p => p.theme.borderColorSplit};
`;

// rc-table defaults to min-width:100% on horizontally scrollable tables;
 // keep the header at the same measured pixel width as react-window cells.
const VirtualTableShell = styled.div<{ $contentWidth: number }>`
  min-width: 0;
  .ant-table-content > table,
  .ant-table-header > table,
  .ant-table-body > table {
    width: ${p => p.$contentWidth}px !important;
    min-width: 0 !important;
  }
`;
