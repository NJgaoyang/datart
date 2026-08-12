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

import { Form, TreeSelect } from 'antd';
import useI18NPrefix from 'app/hooks/useI18NPrefix';
import { DatabaseSchema } from 'app/pages/MainPage/pages/ViewPage/slice/types';
import { memo, useMemo } from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';
import { SPACE_SM } from 'styles/StyleConstants';
import { selectAllSourceDatabaseSchemas } from '../../../slice/selectors';
import { StructViewQueryProps } from '../../../slice/types';
import { getTableAllColumns } from '../../../utils';

const LOGIN_USERNAME_VARIABLE = '$DATART_USER_USERNAME$';

const encodeConditionValue = (path?: string[]) =>
  path?.length ? JSON.stringify(path) : undefined;

const decodeConditionValue = (value?: string): string[] => {
  if (!value) {
    return [];
  }
  try {
    const path = JSON.parse(value);
    return Array.isArray(path) ? path : [];
  } catch {
    return [];
  }
};

interface SelectJoinColumnsProps {
  structure: StructViewQueryProps;
  conditionsIndex: number;
  joinIndex: number;
  sourceId: string;
  allowManage: boolean;
  onChange: (field, type, index) => void;
}

const SelectJoinColumns = memo(
  ({
    structure,
    conditionsIndex,
    joinIndex,
    sourceId,
    allowManage,
    onChange,
  }: SelectJoinColumnsProps) => {
    const t = useI18NPrefix(`view.structView`);
    const allDatabaseSchemas = useSelector(selectAllSourceDatabaseSchemas);

    const permissionVariableTree = useMemo(() => {
      return {
        title: t('permissionVariable'),
        value: '__permission_variables__',
        selectable: false,
        children: [
          {
            title: t('loginUsername'),
            value: encodeConditionValue([LOGIN_USERNAME_VARIABLE]),
          },
        ],
      };
    }, [t]);

    const currentDatabaseSchemas = useMemo((): DatabaseSchema[] => {
      return allDatabaseSchemas[sourceId];
    }, [allDatabaseSchemas, sourceId]);

    const selectableFields = useMemo(() => {
      const tables = [
        structure?.table,
        ...(structure?.joins || [])
          .slice(0, joinIndex + 1)
          .map(join => join.table),
      ].filter((table): table is string[] => !!table?.length);

      return [
        ...tables.map((table, index) => ({
          title: table.join('.'),
          value: `__join_table_${index}__`,
          selectable: false,
          children: getTableAllColumns(table, currentDatabaseSchemas).map(
            column => ({
              title: column.label,
              value: encodeConditionValue([...table, column.value]),
            }),
          ),
        })),
        permissionVariableTree,
      ];
    }, [currentDatabaseSchemas, joinIndex, permissionVariableTree, structure]);

    return (
      <Line key={conditionsIndex}>
        <FormItem
          name={'left' + joinIndex + conditionsIndex}
          rules={[{ required: true, message: t('selectField') }]}
        >
          <ColumnSelect
            dropdownMatchSelectWidth={false}
            allowClear
            placeholder={t('selectField')}
            treeDefaultExpandAll={true}
            onChange={value => {
              allowManage &&
                onChange(
                  decodeConditionValue(value as string),
                  'left',
                  conditionsIndex,
                );
            }}
            treeData={selectableFields}
          />
        </FormItem>
        <Equal>=</Equal>
        <FormItem
          name={'right' + joinIndex + conditionsIndex}
          rules={[{ required: true, message: t('selectField') }]}
        >
          <ColumnSelect
            dropdownMatchSelectWidth={false}
            allowClear
            placeholder={t('selectField')}
            treeDefaultExpandAll={true}
            onChange={value => {
              allowManage &&
                onChange(
                  decodeConditionValue(value as string),
                  'right',
                  conditionsIndex,
                );
            }}
            treeData={selectableFields}
          />
        </FormItem>
      </Line>
    );
  },
);

const Line = styled.div``;

const FormItem = styled(Form.Item)`
  display: inline-block;
`;

const ColumnSelect = styled(TreeSelect)`
  min-width: 120px;
`;

const Equal = styled.span`
  margin: 0 ${SPACE_SM};
`;

export default SelectJoinColumns;
