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

import { ConfigProvider, Table } from 'antd';
import { antdLocales } from 'locales/i18n';
import { FC, memo, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

interface TableStyleConfigProps {
  odd?: {
    backgroundColor: string;
    color: string;
  };
  even?: {
    backgroundColor: string;
    color: string;
  };
  isFixedColumns?: boolean;
  summaryStyle?: {
    backgroundColor?: string;
    fontFamily?: string;
    fontSize?: string;
    fontWeight?: string;
    fontStyle?: string;
    color?: string;
  };
}

const AntdTableWrapper: FC<{
  dataSource: [];
  columns: [];
  widgetId?: string;
  children?: ReactNode;
  tableStyleConfig?: TableStyleConfigProps | undefined;
  summaryFn?: (data) => { total: number; summarys: [] };
}> = memo(
  ({
    dataSource,
    columns,
    children,
    widgetId,
    summaryFn,
    tableStyleConfig,
    ...rest
  }) => {
    const { i18n } = useTranslation();

    const getTableSummaryRow = pageData => {
      if (!summaryFn) {
        return undefined;
      }
      const summaryData = summaryFn?.(pageData);
      return (
        <Table.Summary fixed>
          <Table.Summary.Row>
            {(summaryData?.summarys || []).map((data, index) => {
              return (
                <Table.Summary.Cell key={index} index={index}>
                  {data}
                </Table.Summary.Cell>
              );
            })}
          </Table.Summary.Row>
        </Table.Summary>
      );
    };

    return (
      <ConfigProvider locale={antdLocales[i18n.language]}>
        <TableHost data-datart-widget-id={widgetId}>
          <StyledTable
            {...rest}
            tableStyleConfig={tableStyleConfig}
            dataSource={dataSource}
            columns={columns}
            summary={getTableSummaryRow}
          />
        </TableHost>
      </ConfigProvider>
    );
  },
);

const TableHost = styled.div`
  width: 100%;
  min-width: 0;
  height: 100%;
  min-height: 0;
  overflow: hidden;
`;

const StyledTable = styled(Table)<{ tableStyleConfig?: TableStyleConfigProps }>`
  min-width: 0;
  height: 100%;
  overflow: hidden;

  .ant-table {
    background: transparent;
  }
  .ant-table-body {
    overflow: ${p =>
      p?.tableStyleConfig?.isFixedColumns ? 'auto scroll' : 'auto !important'};
  }

  .datart-mobile-board & {
    display: flex;
    flex-direction: column;
    min-height: 0;

    .ant-spin-nested-loading,
    .ant-spin-container {
      height: 100%;
      min-height: 0;
    }

    .ant-spin-container,
    .ant-table,
    .ant-table-container {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      min-height: 0;
    }

    .ant-table {
      background: #fff;
    }

    .ant-table-container {
      border: 0;
    }

    .ant-table-header {
      flex-shrink: 0;
      min-height: 40px;
    }

    .ant-table-body,
    .ant-table-content {
      flex: 1 1 auto;
      min-height: 0;
      overflow-x: scroll !important;
      overflow-y: auto !important;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: auto;
      scrollbar-gutter: stable;
    }

    .ant-table-header > table,
    .ant-table-body > table,
    .ant-table-content > table {
      width: max-content !important;
      min-width: 100% !important;
      table-layout: fixed !important;
    }

    .ant-table-body::-webkit-scrollbar,
    .ant-table-content::-webkit-scrollbar {
      height: 8px;
    }

    .ant-table-body::-webkit-scrollbar-thumb,
    .ant-table-content::-webkit-scrollbar-thumb {
      background: #aeb8c5;
      border-radius: 4px;
    }

    .ant-table-thead > tr > th,
    .ant-table-tbody > tr > td {
      padding: 8px !important;
      white-space: nowrap;
    }

    .ant-table-thead > tr > th {
      height: 40px;
      line-height: 22px;
      vertical-align: middle;
    }

    .ant-table-content > table > .ant-table-thead > tr > th {
      position: sticky;
      top: 0;
      z-index: 3;
    }

    .ant-table-column-title {
      overflow: visible;
      text-overflow: clip;
    }

    .ant-table-thead > tr > th:first-child,
    .ant-table-tbody > tr > td:first-child {
      position: sticky;
      left: 0;
      width: 88px !important;
      min-width: 88px !important;
      max-width: 96px !important;
      padding-right: 8px !important;
      padding-left: 8px !important;
      background: #fff;
    }

    .ant-table-thead > tr > th:first-child {
      z-index: 4;
    }

    .ant-table-tbody > tr > td:first-child {
      z-index: 2;
    }
  }

  /* 极窄边分页区域 */
  .ant-table-footer {
    flex-shrink: 0;
    padding: 2px 8px !important;
  }
  .ant-pagination {
    margin: 0 !important;
    font-size: 12px;
  }
  /* 分页器内部元素紧凑化 */
  .ant-pagination-item,
  .ant-pagination-prev,
  .ant-pagination-next {
    min-width: 24px !important;
    height: 24px !important;
    margin-inline-start: 4px !important;
    line-height: 22px !important;
  }
  .ant-pagination-options {
    margin-inline-start: 8px !important;
  }
  .ant-select-selector {
    min-height: 24px !important;
  }
  .ant-table .ant-table-container .ant-table-body .ant-table-tbody td {
    background: inherit;
  }

  .ant-table-summary .ant-table-cell {
    font-family: ${p => p?.tableStyleConfig?.summaryStyle?.fontFamily};
    font-size: ${p => p?.tableStyleConfig?.summaryStyle?.fontSize + 'px'};
    font-style: ${p => p?.tableStyleConfig?.summaryStyle?.fontStyle};
    font-weight: ${p => p?.tableStyleConfig?.summaryStyle?.fontWeight};
    color: ${p => p?.tableStyleConfig?.summaryStyle?.color};
    background-color: ${p =>
      p?.tableStyleConfig?.summaryStyle?.backgroundColor};
  }

  .ant-table .ant-table-container .ant-table-body .datart-basic-table-odd {
    color: ${p => p?.tableStyleConfig?.odd?.color || 'inherit'};
    background: ${p =>
      p?.tableStyleConfig?.odd?.backgroundColor || 'transparent'};
  }

  .ant-table .ant-table-container .ant-table-body .datart-basic-table-even {
    color: ${p => p?.tableStyleConfig?.even?.color || 'inherit'};
    background: ${p =>
      p?.tableStyleConfig?.even?.backgroundColor || 'transparent'};
  }
`;

export default AntdTableWrapper;
