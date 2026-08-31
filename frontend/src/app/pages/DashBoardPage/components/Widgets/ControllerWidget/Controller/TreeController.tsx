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
import { Form, Tree, TreeSelect } from 'antd';
import useI18NPrefix from 'app/hooks/useI18NPrefix';
import { RelationFilterValue } from 'app/types/ChartConfig';
import React, { memo, useCallback } from 'react';
import styled from 'styled-components';

export interface TreeControllerFormProps {
  treeData?: RelationFilterValue[];
  value?: string[];
  placeholder?: string;
  onChange: (values) => void;
  label?: React.ReactNode;
  name?: string;
  required?: boolean;
  parentFields?: string[];
}

export const TreeControllerForm: React.FC<TreeControllerFormProps> = memo(
  ({ label, name, required, ...rest }) => {
    return (
      <Form.Item
        name={name}
        label={label}
        validateTrigger={['onChange', 'onBlur']}
        rules={[{ required: false }]}
      >
        <TreeSelectController {...rest} />
      </Form.Item>
    );
  },
);
export const TreeSelectController: React.FC<TreeControllerFormProps> = memo(
  ({ treeData, onChange, value }) => {
    const t = useI18NPrefix(`viz.common.enum.controllerPlaceHolders`);
    const handleonChange = useCallback(
      checkedObj => {
        onChange(checkedObj?.checked);
      },
      [onChange],
    );

    return (
      <StyledTreeSelect
        allowClear
        value={value}
        style={{ width: '100%' }}
        placeholder={t('treeSelectController')}
        maxTagTextLength={4}
        maxTagCount={3}
        onChange={onChange}
        multiple
        bordered={false}
        treeData={treeData}
        dropdownStyle={{ height: '300px', overflowY: 'auto' }}
        dropdownRender={() => {
          return (
            <Tree
              checkedKeys={value}
              onCheck={handleonChange}
              checkable
              checkStrictly
              titleRender={(node: any) => {
                return node.title || node.key;
              }}
              treeData={treeData}
            />
          );
        }}
      />
    );
  },
);
const StyledTreeSelect = styled(TreeSelect)`
  display: flex !important;
  min-width: 0;

  &.ant-select .ant-select-selector {
    background-color: transparent !important;
  }

  /* 多选标签不换行，溢出折叠而非撞宽容器 */
  &.ant-select-multiple .ant-select-selection-overflow {
    flex: 1;
    flex-wrap: nowrap !important;
    min-width: 0;
    max-height: 32px;
    overflow: hidden;
  }

  &.ant-select-multiple .ant-select-selection-overflow-item {
    flex-shrink: 1;
    min-width: 0;
  }

  &.ant-select-multiple .ant-select-selection-search {
    min-width: 20px;
  }
`;
