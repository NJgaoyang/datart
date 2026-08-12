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
import { Form, Select } from 'antd';
import { SelectValue } from 'antd/lib/select';
import useI18NPrefix from 'app/hooks/useI18NPrefix';
import { ControlOption } from 'app/pages/DashBoardPage/pages/BoardEditor/components/ControllerWidgetPanel/types';
import React, { memo } from 'react';
import styled from 'styled-components';

export interface SelectControllerProps {
  options?: ControlOption[];
  value?: SelectValue;
  placeholder?: string;
  onChange: (values) => void;
  label?: React.ReactNode;
  name?: string;
  required?: boolean;
}
const { Option } = Select;
export const MultiSelectControllerForm: React.FC<SelectControllerProps> = memo(
  ({ label, name, required, ...rest }) => {
    return (
      <Form.Item
        name={name}
        label={label}
        validateTrigger={['onChange', 'onBlur']}
        rules={[{ required: false }]}
      >
        <SelectController {...rest} />
      </Form.Item>
    );
  },
);
export const SelectController: React.FC<SelectControllerProps> = memo(
  ({ options, onChange, value }) => {
    const t = useI18NPrefix(`viz.common.enum.controllerPlaceHolders`);
    return (
      <StyledSelect
        showSearch
        allowClear
        value={value}
        style={{ width: '100%' }}
        placeholder={t('multiSelectController')}
        maxTagTextLength={4}
        maxTagCount={3}
        maxTagPlaceholder={(omittedValues) => (
          <span style={{ whiteSpace: 'nowrap' }}>+{omittedValues.length}...</span>
        )}
        optionFilterProp="label"
        onChange={onChange}
        mode={'multiple'}
        bordered={false}
        filterOption={(input, option) =>
          String(option?.label).toLowerCase().indexOf(input.toLowerCase()) >= 0
        }
      >
        {(options || []).map(item => {
          //  ##659
          return (
            <Option
              key={item.value + item.label}
              label={item.label ?? item.value ?? 'none'}
              value={item.value}
            >
              <span>{item.label ?? item.value}</span>
            </Option>
          );
        })}
      </StyledSelect>
    );
  },
);
const StyledSelect = styled(Select)`
  display: flex !important;
  min-width: 0;

  &.ant-select .ant-select-selector {
    background-color: transparent !important;
  }

  /* 多选标签不换行，溢出折叠而非撑宽容器 */
  &.ant-select-multiple .ant-select-selection-overflow {
    flex-wrap: nowrap !important;
    overflow: hidden;
    max-height: 32px;
    min-width: 0;
    flex: 1;
  }

  &.ant-select-multiple .ant-select-selection-overflow-item {
    min-width: 0;
    flex-shrink: 1;
  }

  /* 搜索输入框允许收缩，避免撑宽容器 */
  &.ant-select-multiple .ant-select-selection-search {
    min-width: 20px;
  }
`;
