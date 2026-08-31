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

import { Col, Input, Row, Select, Space, Tabs, TreeDataNode } from 'antd';
import { FormItemEx, Tree } from 'app/components';
import { ChartDataViewFieldCategory, DataViewFieldType } from 'app/constants';
import useI18NPrefix from 'app/hooks/useI18NPrefix';
import { ViewType } from 'app/pages/MainPage/pages/ViewPage/slice/types';
import { ChartDataViewMeta } from 'app/types/ChartDataViewMeta';
import { ChartComputedFieldHandle } from 'app/types/ComputedFieldEditor';
import { hasAggregationFunction } from 'app/utils/chartHelper';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { getDatasetFieldDisplayName } from 'utils/utils';
import { fetchSourceFunctionDefinitionsAsync } from 'app/utils/fetch';
import ChartComputedFieldEditor from './ChartComputedFieldEditor/ChartComputedFieldEditor';
import ChartSearchableList from './ChartSearchableList';
import {
  ComputedFieldDisplayName,
  toDisplayExpression,
  toQueryExpression,
} from './computedFieldExpression';
import ComputedFunctionDescriptions from './computed-function-description-map';
import { FieldTemplate, FunctionTemplate, VariableTemplate } from './utils';

enum TextType {
  Field = 'field',
  Variable = 'variable',
  Function = 'function',
}

const ChartComputedFieldSettingPanel: FC<{
  sourceId?: string;
  computedField?: ChartDataViewMeta;
  allComputedFields?: ChartDataViewMeta[];
  fields?: ChartDataViewMeta[] | TreeDataNode[];
  variables?: ChartDataViewMeta[];
  viewType?: ViewType;
  onChange?: (computedField?: ChartDataViewMeta) => void;
}> = ({
  sourceId,
  computedField,
  allComputedFields,
  fields,
  variables,
  viewType,
  onChange,
}) => {
  const t = useI18NPrefix(`viz.workbench.dataview`);
  const defaultFunctionCategory = 'all';
  const editorRef = useRef<ChartComputedFieldHandle>(null);
  const myComputedFieldRef = useRef(computedField);
  const [selectedFunctionCategory, setSelectedFunctionCategory] = useState(
    defaultFunctionCategory,
  );
  const [availableSourceFunctions, setAvailableSourceFunctions] = useState<
    string[] | undefined
  >();

  useEffect(() => {
    let active = true;
    if (!sourceId) {
      setAvailableSourceFunctions(undefined);
      return;
    }
    fetchSourceFunctionDefinitionsAsync(sourceId)
      .then(
        definitions =>
          active &&
          setAvailableSourceFunctions(definitions.map(item => item.name)),
      )
      .catch(() => active && setAvailableSourceFunctions(undefined));
    return () => {
      active = false;
    };
  }, [sourceId]);

  const supportedFunctionDescriptions = useMemo(() => {
    if (sourceId && !availableSourceFunctions) {
      return [];
    }
    if (!availableSourceFunctions) {
      return ComputedFunctionDescriptions;
    }
    const supported = new Set(availableSourceFunctions);
    return ComputedFunctionDescriptions.filter(item =>
      supported.has(item.name),
    );
  }, [availableSourceFunctions, sourceId]);

  const editorFieldNames = useMemo<ComputedFieldDisplayName[]>(() => {
    const result: ComputedFieldDisplayName[] = [];
    const collectFields = (items: any[] = []) => {
      items.forEach(item => {
        if (item?.children?.length) {
          collectFields(item.children);
          return;
        }

        const key = item?.key;
        const name = String(
          item?.name || (Array.isArray(key) ? key[key.length - 1] : key) || '',
        );
        if (!name) return;

        const label = String(
          item?.title || getDatasetFieldDisplayName(item) || name,
        );
        result.push({ name, label });
      });
    };
    collectFields(fields as any[]);

    const labelCounts = result.reduce<Record<string, number>>(
      (counts, field) => {
        counts[field.label] = (counts[field.label] || 0) + 1;
        return counts;
      },
      {},
    );
    return result.map(field => ({
      ...field,
      label:
        labelCounts[field.label] > 1
          ? `${field.label}（${field.name}）`
          : field.label,
    }));
  }, [fields]);

  useEffect(() => {
    if (computedField) {
      onChange?.(computedField);
    }
  }, [computedField, onChange]);

  // --- Resizable left pane ---
  const [leftPaneWidth, setLeftPaneWidth] = useState(200);
  const resizeRef = useRef({
    isDragging: false,
    startX: 0,
    startWidth: 200,
  });

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      resizeRef.current = {
        isDragging: true,
        startX: e.clientX,
        startWidth: leftPaneWidth,
      };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    },
    [leftPaneWidth],
  );

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current.isDragging) return;
      const diff = e.clientX - resizeRef.current.startX;
      const newWidth = Math.max(
        150,
        Math.min(500, resizeRef.current.startWidth + diff),
      );
      setLeftPaneWidth(newWidth);
    };
    const onMouseUp = () => {
      if (!resizeRef.current.isDragging) return;
      resizeRef.current.isDragging = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const handleChange = (field: ChartDataViewMeta) => {
    const hasAggregation = hasAggregationFunction(field?.expression);
    field.category = hasAggregation
      ? ChartDataViewFieldCategory.AggregateComputedField
      : ChartDataViewFieldCategory.ComputedField;
    myComputedFieldRef.current = field;
    onChange?.(field);
  };

  const handleFieldNameChange = name => {
    const newField = Object.assign({}, myComputedFieldRef.current, {
      name: name,
    });
    handleChange(newField);
  };

  const handleFieldTypeChange = type => {
    const newField = Object.assign({}, myComputedFieldRef.current, { type });
    handleChange(newField);
  };

  const handleExpressionChange = expression => {
    const newField = Object.assign({}, myComputedFieldRef.current, {
      expression: toQueryExpression(expression, editorFieldNames),
    });
    handleChange(newField);
  };

  const getFunctionCategories = (): Array<{ label; value }> => {
    const functionCategories = supportedFunctionDescriptions.reduce<string[]>(
      (acc, cur) => {
        if (acc.find(x => x === cur.type)) {
          return acc;
        }
        return acc.concat([cur.type]);
      },
      [],
    );

    return [defaultFunctionCategory, ...functionCategories].map(item => ({
      label: item,
      value: item,
    }));
  };

  const handleFunctionCategoryChange = category => {
    setSelectedFunctionCategory(category);
  };

  const getFunctionList = () => {
    return supportedFunctionDescriptions
      .filter(
        item =>
          item.type === selectedFunctionCategory ||
          !selectedFunctionCategory ||
          selectedFunctionCategory === defaultFunctionCategory,
      )
      .map(item => ({
        label: item.name,
        value: item.name,
      }));
  };

  const getInputText = (value, type) => {
    switch (type) {
      case TextType.Field:
        return FieldTemplate(value);
      case TextType.Variable:
        return VariableTemplate(value);
      case TextType.Function:
        return FunctionTemplate(value);
      default:
        return value;
    }
  };

  const handleFieldFunctionSelected = funName => {
    const functionDescription = supportedFunctionDescriptions.find(
      f => f.name === funName,
    );

    editorRef.current?.insertField(
      getInputText(funName, TextType.Function),
      functionDescription,
    );
  };

  const handleFieldSelected = useCallback(
    field => {
      const displayName =
        editorFieldNames.find(item => item.name === field)?.label || field;
      editorRef.current?.insertField(getInputText(displayName, TextType.Field));
    },
    [editorFieldNames],
  );

  const handleVariableSelected = variable => {
    editorRef.current?.insertField(getInputText(variable, TextType.Variable));
  };

  const handleOnSelectValue = useCallback(
    selectKeys => {
      if (selectKeys?.length) {
        const selectKey = selectKeys[0] as any;
        // For tree nodes, key is the full path (e.g. ["table", "field"]),
        // extract just the field name to avoid table prefix in expression
        const fieldValue = Array.isArray(selectKey)
          ? selectKey[selectKey.length - 1]
          : selectKey;
        handleFieldSelected(fieldValue);
      }
    },
    [handleFieldSelected],
  );

  return (
    <StyledChartComputedFieldSettingPanel direction="vertical">
      <Row gutter={24}>
        <Col span={12}>
          <Space>
            <FormItemEx
              label={`${t('fieldName')}`}
              name="fieldName"
              rules={[{ required: true }]}
              initialValue={myComputedFieldRef.current?.name}
            >
              <Input onChange={e => handleFieldNameChange(e.target.value)} />
            </FormItemEx>
          </Space>
        </Col>
        <Col span={12}>
          <Space>
            <FormItemEx
              label={`${t('type')}`}
              name="type"
              rules={[{ required: true }]}
              initialValue={myComputedFieldRef.current?.type}
            >
              <Select
                value={myComputedFieldRef.current?.type}
                options={Object.keys(DataViewFieldType).map(type => {
                  return {
                    label: type,
                    value: DataViewFieldType[type],
                  };
                })}
                onChange={handleFieldTypeChange}
              ></Select>
            </FormItemEx>
          </Space>
        </Col>
      </Row>
      <StyledRow>
        <StyledLeftPane style={{ width: leftPaneWidth }}>
          <Tabs defaultActiveKey="field" onChange={() => {}}>
            <Tabs.TabPane tab={`${t('field')}`} key="field">
              {viewType === 'STRUCT' ? (
                <Tree
                  className="medium"
                  loading={false}
                  showIcon={false}
                  treeData={fields as TreeDataNode[]}
                  defaultExpandAll={true}
                  height={300}
                  onSelect={handleOnSelectValue}
                />
              ) : (
                <ChartSearchableList
                  source={(fields || []).map(f => ({
                    value: f.name,
                    label: getDatasetFieldDisplayName(f),
                  }))}
                  onItemSelected={handleFieldSelected}
                />
              )}
            </Tabs.TabPane>
            <Tabs.TabPane tab={`${t('variable')}`} key="variable">
              <ChartSearchableList
                source={(variables || []).map(f => ({
                  value: f.name,
                  label: f.name,
                }))}
                onItemSelected={handleVariableSelected}
              />
            </Tabs.TabPane>
          </Tabs>
        </StyledLeftPane>
        <StyledResizer onMouseDown={handleResizeMouseDown}>
          <div />
        </StyledResizer>
        <StyledMiddlePane>
          <ChartComputedFieldEditor
            ref={editorRef}
            value={toDisplayExpression(
              myComputedFieldRef.current?.expression,
              editorFieldNames,
            )}
            functionDescriptions={supportedFunctionDescriptions}
            onChange={handleExpressionChange}
          />
        </StyledMiddlePane>
        <StyledRightPane>
          <Space direction="vertical" style={{ width: '100%' }}>
            <span>{`${t('functions')}`}</span>
            <Select
              value={selectedFunctionCategory}
              options={getFunctionCategories()}
              onChange={handleFunctionCategoryChange}
            />
            <ChartSearchableList
              source={getFunctionList()}
              onItemSelected={handleFieldFunctionSelected}
            />
          </Space>
        </StyledRightPane>
      </StyledRow>
    </StyledChartComputedFieldSettingPanel>
  );
};

export default ChartComputedFieldSettingPanel;

const StyledChartComputedFieldSettingPanel = styled(Space)`
  width: 100%;
  margin-top: 10px;

  .ant-select {
    width: 100%;
  }

  .ant-space-horizontal {
    width: 100%;
    .ant-space-item:last-child {
      flex: 1;
    }
  }

  .ant-form-item-control-input {
    width: 200px;
  }

  & .searchable-list-container {
    flex: 1;
    height: auto;
  }
`;

const StyledRow = styled.div`
  display: flex;
  gap: 8px;
  align-items: stretch;
  height: 400px;
  max-height: 400px;
  margin-top: 16px;
`;

const StyledLeftPane = styled.div`
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  .ant-tabs {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .ant-tabs-content-holder {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
`;

const StyledResizer = styled.div`
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 6px;
  cursor: col-resize;
  background: transparent;
  border-radius: 3px;
  transition: background 0.15s;
  &:hover,
  &:active {
    background: #d9d9d9;
  }
  div {
    width: 2px;
    height: 80px;
    background: #c0c0c0;
    border-radius: 1px;
  }
`;

const StyledMiddlePane = styled.div`
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
`;

const StyledRightPane = styled.div`
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  width: 200px;
  .ant-space {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }
  .ant-space-item:last-child {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
`;
