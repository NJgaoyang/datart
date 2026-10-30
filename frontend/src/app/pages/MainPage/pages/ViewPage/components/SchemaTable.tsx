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

import {
  CalendarOutlined,
  FieldStringOutlined,
  NumberOutlined,
} from '@ant-design/icons';
import { TableColumnType, TableProps } from 'antd';
import { ToolbarButton } from 'app/components';
import { VirtualTable } from 'app/components/VirtualTable';
import { DataViewFieldType } from 'app/constants';
import { PreviewFieldMeta, ViewFieldMeta } from 'app/types/View';
import { TABLE_DATA_INDEX } from 'globalConstants';
import { memo, ReactElement, useMemo } from 'react';
import styled from 'styled-components';
import { FONT_SIZE_BASE, SPACE, SPACE_SM, WARNING } from 'styles/StyleConstants';
import { getFieldDisplayName, uuidv4 } from 'utils/utils';
import { Column, ColumnsModel, DatabaseSchema, Model } from '../slice/types';
import {
  getColumnWidthMap,
  getHierarchyColumn,
  getViewColumnDisplayMeta,
  resolveSchemaColumnComment,
} from '../utils';
import { DatasetCommentLabel } from './DatasetCommentLabel';
import SetFieldType from './SetFieldType';

const ROW_KEY = 'DATART_ROW_KEY';

interface SchemaTableProps extends TableProps<object> {
  height: number;
  width: number;
  model: ColumnsModel;
  hierarchy: Model;
  dataSource?: object[];
  hasCategory?: boolean;
  hasFormat?: boolean;
  sourceId?: string;
  databaseSchemas?: DatabaseSchema[];
  viewFields?: Array<ViewFieldMeta | PreviewFieldMeta>;
  previewFields?: PreviewFieldMeta[];
  readOnly?: boolean;
  getExtraHeaderActions?: (
    name: string,
    column: Omit<Column, 'name'>,
  ) => ReactElement[];
  onSchemaTypeChange: (
    namePath: string,
    column: Omit<Column, 'name'>,
  ) => (namePath: string[]) => void;
}

export const SchemaTable = memo(
  ({
    height,
    width: propsWidth,
    model,
    hierarchy,
    dataSource,
    hasFormat,
    hasCategory,
    sourceId,
    databaseSchemas,
    viewFields,
    previewFields,
    readOnly = false,
    getExtraHeaderActions,
    onSchemaTypeChange,
    ...tableProps
  }: SchemaTableProps) => {
    const dataSourceWithKey = useMemo(
      () =>
        dataSource?.map((o, index) => ({
          ...o,
          [ROW_KEY]: uuidv4(),
          [TABLE_DATA_INDEX]: index + 1,
        })),
      [dataSource],
    );
    const displayColumns = useMemo(
      () =>
        Object.fromEntries(
          Object.entries(model).map(([name, column]) => {
            const hierarchyColumn = getHierarchyColumn(name, hierarchy) || column;
            const identity = {
              ...column,
              ...hierarchyColumn,
              fieldId: hierarchyColumn.fieldId || column.fieldId,
              name,
              path: (hierarchyColumn as Column).path,
              comment:
                resolveSchemaColumnComment(databaseSchemas, {
                  name,
                  path: (hierarchyColumn as Column).path,
                }) ||
                hierarchyColumn.comment ||
                column.comment,
            };
            return [
              name,
              {
                ...identity,
                ...getViewColumnDisplayMeta(identity, viewFields, previewFields),
              },
            ];
          }),
        ),
      [model, hierarchy, databaseSchemas, viewFields, previewFields],
    );
    const columnWidthMap = useMemo(
      () => getColumnWidthMap(displayColumns, dataSource || []),
      [displayColumns, dataSource],
    );
    const indexColumnWidth = 50;

    const {
      columns,
      tableWidth,
    }: {
      columns: TableColumnType<object>[];
      tableWidth: number;
    } = useMemo(() => {
      let tableWidth = 0;
      const columns = Object.entries(model).map(([name, column]) => {
        const hierarchyColumn = getHierarchyColumn(name, hierarchy) || column;
        const displayColumn = displayColumns[name];

        const width = columnWidthMap[name];
        tableWidth += width;

        let icon;
        switch (hierarchyColumn.type) {
          case DataViewFieldType.NUMERIC:
            icon = <NumberOutlined />;
            break;
          case DataViewFieldType.DATE:
          case DataViewFieldType.DATETIME:
            icon = <CalendarOutlined />;
            break;
          default:
            icon = <FieldStringOutlined />;
            break;
        }

        const extraActions =
          !readOnly && getExtraHeaderActions?.(name, hierarchyColumn);

        const displayText = getFieldDisplayName(displayColumn);

        const title = (
          <>
            <span className="content">
              <DatasetCommentLabel
                label={displayText}
                comment={displayColumn.sourceComment || displayColumn.comment}
                hasCustomName={Boolean(displayColumn.customName)}
                source={name}
                focusable
              />
            </span>
            {readOnly && <span className="type-icon" title={String(column.type)}>{icon}</span>}
            {!readOnly && (
              <SetFieldType
                field={hierarchyColumn as Column}
                hasCategory={hasCategory}
                hasFormat={hasFormat}
                onChange={onSchemaTypeChange(name, hierarchyColumn)}
                icon={
                  <ToolbarButton
                    size="small"
                    iconSize={FONT_SIZE_BASE}
                    className="suffix"
                    icon={icon}
                  />
                }
              />
            )}
            {extraActions}
          </>
        );

        return {
          title,
          dataIndex: name,
          width,
          align:
            column.type === DataViewFieldType.NUMERIC
              ? ('right' as const)
              : ('left' as const),
        };
      });

      return {
        columns: [
          {
            align: 'center',
            title: '#',
            dataIndex: TABLE_DATA_INDEX,
            width: indexColumnWidth,
          },
          ...columns,
        ],
        tableWidth,
      };
    }, [
      model,
      hierarchy,
      columnWidthMap,
      displayColumns,
      hasCategory,
      hasFormat,
      databaseSchemas,
      viewFields,
      previewFields,
      readOnly,
      getExtraHeaderActions,
      onSchemaTypeChange,
    ]);

    return (
      <VirtualTable
        {...tableProps}
        rowKey={ROW_KEY}
        size="small"
        components={{ header: { cell: TableHeader } }}
        dataSource={dataSourceWithKey}
        columns={columns}
        scroll={{ x: tableWidth + indexColumnWidth, y: height }}
        width={propsWidth}
      />
    );
  },
);

function TableHeader({ children, className, ...props }) {
  return (
    <TH {...props} scope="col" className={['ant-table-cell', className].filter(Boolean).join(' ')}>
      <div className="content-wrapper">{children}</div>
    </TH>
  );
}

const TH = styled.th`
  padding: ${SPACE_SM} ${SPACE} !important;
  font-size: 13px;
  font-weight: 500;
  background-color: ${p => p.theme.emphasisBackground};

  .content-wrapper {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;

    .type-icon { flex: none; color: ${p => p.theme.textColorSnd}; }

    .btn {
      &:hover {
        background-color: ${p => p.theme.emphasisBackground};
      }
    }

    .content {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .prefix {
      margin-right: ${SPACE};
    }

    .suffix {
      margin-left: ${SPACE};
    }

    .partial {
      color: ${WARNING};
    }
  }
`;
