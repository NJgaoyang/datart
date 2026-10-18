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

import { ConfigProvider, Form } from 'antd';
import { ControllerFacadeTypes, TimeFilterValueCategory } from 'app/constants';
import { ControllerWidgetContent } from 'app/pages/DashBoardPage/pages/Board/slice/types';
import {
  ControllerConfig,
  ControllerDate,
  ControlOption,
} from 'app/pages/DashBoardPage/pages/BoardEditor/components/ControllerWidgetPanel/types';
import { Widget } from 'app/pages/DashBoardPage/types/widgetTypes';
import { getControllerDateValues } from 'app/pages/DashBoardPage/utils';
import { RelationFilterValue } from 'app/types/ChartConfig';
import { produce } from 'immer';
import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from 'react';
import styled from 'styled-components';
import { isEmpty } from 'utils/object';
import { convertToTree } from '../../../utils/widget';
import { WidgetActionContext } from '../../ActionProvider/WidgetActionProvider';
import { WidgetTitle } from '../../WidgetComponents/WidgetTitle';
import { getWidgetTitle } from '../../WidgetManager/utils/utils';
import { WidgetDataContext } from '../../WidgetProvider/WidgetDataProvider';
import { WidgetContext } from '../../WidgetProvider/WidgetProvider';
import { CheckboxGroupControllerForm } from './Controller/CheckboxGroupController';
import { MultiSelectControllerForm } from './Controller/MultiSelectController';
import { NumberControllerForm } from './Controller/NumberController';
import { RadioGroupControllerForm } from './Controller/RadioGroupController';
import { RangeNumberControllerForm } from './Controller/RangeNumberController';
import { RangeTimeControllerForm } from './Controller/RangeTimeController';
import { SelectControllerForm } from './Controller/SelectController';
import { SlideControllerForm } from './Controller/SliderController';
import { TextControllerForm } from './Controller/TextController';
import { TimeControllerForm } from './Controller/TimeController';
import { TreeControllerForm } from './Controller/TreeController';

export const ControllerWidgetCore: React.FC<{}> = memo(() => {
  const widget = useContext(WidgetContext);
  const content = widget.config.content as ControllerWidgetContent;
  const { onUpdateWidgetConfigByKey, onRefreshWidgetsByController } =
    useContext(WidgetActionContext);
  // TODO 由控制器自己控制 要不要触发查询
  // const emitQuery = getControlQueryEnable(widget.config.customConfig.props!);
  const [form] = Form.useForm();

  // One native body/fullscreen portal is enough for all controls.
  // Per-widget position:fixed hosts drifted under zoom/scroll and created
  // hundreds of temporary DOM nodes on large dashboards.
  const popupContainer = useCallback(
    () => (document.fullscreenElement || document.body) as HTMLElement,
    [],
  );

  const { data: dataset } = useContext(WidgetDataContext);

  const refreshLinkedWidgets = useCallback(
    (widget: Widget) => {
      // if (!emitQuery) return;
      onRefreshWidgetsByController(widget);
    },
    [onRefreshWidgetsByController],
  );
  const { config, type: facadeType } = useMemo(() => content, [content]);

  const {
    controllerDate,
    controllerValues,
    valueOptions,
    valueOptionType,
    parentFields,
    buildingMethod,
    // sqlOperator,
  } = useMemo(() => config as ControllerConfig, [config]);
  const title = getWidgetTitle(widget.config.customConfig.props);
  title.title = widget.config.name;
  const leftControlLabel = useMemo(() => {
    if (!title.showTitle) {
      return null;
    }
    if (title.textAlign === 'center') {
      return null;
    }
    return <WidgetTitle title={title} />;
  }, [title]);
  const centerControlLabel = useMemo(() => {
    if (!title.showTitle) {
      return null;
    }
    if (title.textAlign === 'center') {
      return (
        <div style={{ width: '100%', textAlign: 'center' }}>
          <WidgetTitle title={title} />
        </div>
      );
    }
    return null;
  }, [title]);
  const optionRows = useMemo(() => {
    const dataRows = dataset?.rows || [];

    if (valueOptionType === 'common') {
      if (parentFields?.length) {
        return convertToTree(dataRows, buildingMethod);
      }
      return dataRows.map(ele => {
        const item: RelationFilterValue = {
          key: ele?.[0],
          label: ele?.[1] ?? ele?.[0],
          // children?
        };
        return item;
      });
    } else if (valueOptionType === 'custom') {
      return valueOptions;
    } else {
      return [];
    }
  }, [
    dataset?.rows,
    valueOptionType,
    valueOptions,
    parentFields,
    buildingMethod,
  ]);

  const onControllerChange = useCallback(() => {
    form.submit();
  }, [form]);

  const onFinish = value => {
    const values = value.value;
    if (values && typeof values === 'object' && !Array.isArray(values)) {
      return;
    }
    const _values = !isEmpty(values)
      ? Array.isArray(values)
        ? values
        : [values]
      : [];
    const nextContent = produce(content, draft => {
      draft.config.controllerValues = _values;
    });
    onUpdateWidgetConfigByKey({
      wid: widget.id,
      key: 'content',
      val: nextContent,
    });

    refreshLinkedWidgets(widget);
  };
  // const onSqlOperatorAndValues = useCallback(
  //   (sql: FilterSqlOperator, values: any[]) => {
  //     const nextWidget = produce(widget, draft => {
  //       (draft.config.content as ControllerWidgetContent).config.sqlOperator =
  //         sql;
  //       (
  //         draft.config.content as ControllerWidgetContent
  //       ).config.controllerValues = values;
  //     });
  //     widgetUpdate(nextWidget);
  //     refreshWidgetsByFilter(nextWidget);
  //   },
  //   [refreshWidgetsByFilter, widget, widgetUpdate],
  // );
  const onRangeTimeChange = useCallback(
    (timeValues: string[] | null) => {
      const nextFilterDate: ControllerDate = {
        ...controllerDate!,
        startTime: {
          relativeOrExact: TimeFilterValueCategory.Exact,
          exactValue: timeValues?.[0],
        },
        endTime: {
          relativeOrExact: TimeFilterValueCategory.Exact,
          exactValue: timeValues?.[1],
        },
      };
      const nextContent = produce(content, draft => {
        draft.config.controllerDate = nextFilterDate;
      });
      onUpdateWidgetConfigByKey({
        wid: widget.id,
        key: 'content',
        val: nextContent,
      });
      refreshLinkedWidgets(widget);
    },
    [
      controllerDate,
      content,
      onUpdateWidgetConfigByKey,
      widget,
      refreshLinkedWidgets,
    ],
  );

  const onTimeChange = useCallback(
    (value: string | null) => {
      const nextFilterDate: ControllerDate = {
        ...controllerDate!,
        startTime: {
          relativeOrExact: TimeFilterValueCategory.Exact,
          exactValue: value,
        },
      };

      const nextContent = produce(content, draft => {
        draft.config.controllerDate = nextFilterDate;
      });
      onUpdateWidgetConfigByKey({
        wid: widget.id,
        key: 'content',
        val: nextContent,
      });
      refreshLinkedWidgets(widget);
    },
    [
      controllerDate,
      content,
      onUpdateWidgetConfigByKey,
      widget,
      refreshLinkedWidgets,
    ],
  );

  // Synchronize persisted filter values after render. Calling setFieldsValue
  // inside useMemo mutates the AntD form during React's render phase.
  useEffect(() => {
    const isRangeTime = facadeType === ControllerFacadeTypes.RangeTime;
    const isTime = facadeType === ControllerFacadeTypes.Time;
    const isArrayControl = [
      ControllerFacadeTypes.MultiDropdownList,
      ControllerFacadeTypes.CheckboxGroup,
      ControllerFacadeTypes.RangeValue,
      ControllerFacadeTypes.DropDownTree,
    ].includes(facadeType);
    const value = isTime || isRangeTime
      ? getControllerDateValues({
          controlType: facadeType,
          filterDate: config!.controllerDate!,
        })
      : controllerValues;
    form.setFieldsValue({
      value: isTime
        ? value?.[0]
        : isRangeTime || isArrayControl
          ? value
          : value?.[0],
    });
  }, [facadeType, controllerValues, config, form]);

  const control = useMemo(() => {
    let selectOptions = optionRows?.map(ele => {
      return { value: ele.key, label: ele.label } as ControlOption;
    });
    switch (facadeType) {
      case ControllerFacadeTypes.DropdownList:
        return (
          <SelectControllerForm
            onChange={onControllerChange}
            options={selectOptions}
            name={'value'}
            label={leftControlLabel}
          />
        );

      case ControllerFacadeTypes.MultiDropdownList:
        return (
          <MultiSelectControllerForm
            onChange={onControllerChange}
            options={selectOptions}
            name={'value'}
            label={leftControlLabel}
          />
        );
      case ControllerFacadeTypes.CheckboxGroup:
        return (
          <CheckboxGroupControllerForm
            onChange={onControllerChange}
            options={selectOptions}
            name={'value'}
            label={leftControlLabel}
          />
        );
      case ControllerFacadeTypes.Slider:
        const step = config.sliderConfig?.step || 1;
        const showMarks = config.sliderConfig?.showMarks || false;
        let minValue = config.minValue === 0 ? 0 : config.minValue || 1;
        let maxValue = config.maxValue === 0 ? 0 : config.maxValue || 100;
        return (
          <SlideControllerForm
            onChange={onControllerChange}
            minValue={minValue}
            maxValue={maxValue}
            step={step}
            name="value"
            showMarks={showMarks}
            label={leftControlLabel}
          />
        );

      case ControllerFacadeTypes.Value:
        return (
          <NumberControllerForm
            onChange={onControllerChange}
            name="value"
            label={leftControlLabel}
          />
        );

      case ControllerFacadeTypes.RangeValue:
        return (
          <RangeNumberControllerForm
            onChange={onControllerChange}
            name="value"
            label={leftControlLabel}
          />
        );

      case ControllerFacadeTypes.Text:
        return (
          <TextControllerForm
            onChange={onControllerChange}
            label={leftControlLabel}
            name="value"
          />
        );

      case ControllerFacadeTypes.RadioGroup:
        let RadioOptions = optionRows?.map(ele => {
          return { value: ele.key, label: ele.label } as ControlOption;
        });
        let radioButtonType = config.radioButtonType;
        return (
          <RadioGroupControllerForm
            label={leftControlLabel}
            radioButtonType={radioButtonType}
            onChange={onControllerChange}
            options={RadioOptions}
            name="value"
          />
        );

      case ControllerFacadeTypes.RangeTime:
        let rangePickerType = controllerDate!.pickerType;
        return (
          <RangeTimeControllerForm
            label={leftControlLabel}
            pickerType={rangePickerType}
            onChange={onRangeTimeChange}
            name="value"
          />
        );

      case ControllerFacadeTypes.Time:
        let pickerType = controllerDate!.pickerType;
        return (
          <TimeControllerForm
            label={leftControlLabel}
            onChange={onTimeChange}
            pickerType={pickerType}
            name="value"
          />
        );

      case ControllerFacadeTypes.DropDownTree:
        return (
          <TreeControllerForm
            parentFields={parentFields}
            onChange={onControllerChange}
            treeData={optionRows}
            name={'value'}
            label={leftControlLabel}
          />
        );

      default:
        break;
    }
  }, [
    optionRows,
    facadeType,
    onControllerChange,
    leftControlLabel,
    config,
    controllerDate,
    parentFields,
    onRangeTimeChange,
    onTimeChange,
  ]);

  return (
    <Wrapper formFrontColor={title?.font?.color}>
      <ConfigProvider getPopupContainer={popupContainer}>
        <Form form={form} className="control-form" onFinish={onFinish}>
          {centerControlLabel}
          {control}
        </Form>
      </ConfigProvider>
    </Wrapper>
  );
});
const Wrapper = styled.div<{ formFrontColor: string }>`
  display: flex;
  flex: 1;
  align-items: center;
  min-width: 0;
  width: 100%;
  container-type: inline-size;

  .control-form {
    flex: 1;
    width: 100%;
    min-width: 0;

    .ant-form-item-row {
      display: flex;
      flex-wrap: nowrap;
      align-items: center;
      min-width: 0;
    }

    .ant-form-item-label {
      flex: 0 1 auto;
      min-width: 0;
      max-width: 40%;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .ant-form-item-control {
      flex: 1 1 0;
      min-width: 0;
    }

    .ant-picker,
    .ant-picker-input,
    .ant-select,
    .ant-select-selector {
      min-width: 0;
      max-width: 100%;
    }

    .ant-select,
    .ant-checkbox-wrapper,
    .ant-input,
    .ant-input-number,
    .ant-slider,
    .ant-picker input,
    .ant-radio-wrapper {
      color: ${p => p.formFrontColor} !important;
    }
  }
  .ant-form-item {
    margin-bottom: 0;
  }
  .ant-input-number-handler {
    border-left: 0;
  }

  /* Long custom labels must not consume the entire picker/selection area.
     Full text remains available through the widget title, when present. */
  .control-form .ant-form-item-label label {
    max-width: 100%;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Narrow half-width widgets stack the label rather than shrink
     a datetime picker beneath its calendar trigger. Saved grid geometry
     remains unchanged. */
  @container (max-width: 300px) {
    .control-form .ant-form-item-row {
      flex-direction: column;
      align-items: stretch;
    }

    .control-form .ant-form-item-label {
      flex: none;
      max-width: 100%;
      padding: 0;
      line-height: 18px;
      text-align: left;
    }

    .control-form .ant-form-item-control {
      flex: 1;
      width: 100%;
      min-width: 0;
    }

    /* Fit the stacked label + picker in a compact 6-row legacy widget. */
    .control-form .ant-picker {
      height: 28px;
      min-height: 28px;
    }
  }


  /*
   * Mobile range dates follow the CONTROL's measured width, not the
   * device viewport or a per-phone breakpoint. Keep "日期" and both dates
   * on one row even in legacy half-width filter widgets. Text inputs
   * shrink continuously with container units, retaining the calendar
   * trigger and editable date fields.
   */
  .datart-mobile-board & {
    .control-form .ant-form-item.mobile-range-time-form .ant-form-item-row {
      display: flex;
      flex-direction: row;
      flex-wrap: nowrap;
      align-items: center;
      gap: 4px;
      min-width: 0;
    }

    .control-form .ant-form-item.mobile-range-time-form .ant-form-item-label {
      flex: 0 0 auto !important;
      width: auto;
      max-width: 28%;
      min-width: 0;
      padding: 0;
      overflow: hidden;
      white-space: nowrap;
      text-align: left;
    }

    .control-form .ant-form-item.mobile-range-time-form .ant-form-item-label > label {
      height: 32px;
      white-space: nowrap;
    }

    .control-form .ant-form-item.mobile-range-time-form .widget-name {
      display: inline-block;
      padding: 0;
      font-size: clamp(11px, 3.7cqi, 14px) !important;
      line-height: 20px;
      white-space: nowrap;
    }

    .control-form .ant-form-item.mobile-range-time-form .ant-form-item-control {
      flex: 1 1 0 !important;
      width: 0;
      min-width: 0;
    }

    .control-form .ant-form-item.mobile-range-time-form .ant-form-item-control-input,
    .control-form .ant-form-item.mobile-range-time-form .ant-form-item-control-input-content,
    .control-form .ant-form-item.mobile-range-time-form .control-datePicker {
      width: 100%;
      min-width: 0;
    }

    .control-form .ant-form-item.mobile-range-time-form .ant-picker-range {
      display: flex;
      align-items: center;
      height: 36px;
      min-height: 36px;
      padding: 0 4px;
      white-space: nowrap;
    }

    .control-form .ant-form-item.mobile-range-time-form .ant-picker-input {
      flex: 1 1 0;
      width: 0;
      min-width: 0;
    }

    .control-form .ant-form-item.mobile-range-time-form .ant-picker-input > input {
      width: 100%;
      min-width: 0;
      height: 30px;
      min-height: 0;
      font-size: clamp(10px, 3.4cqi, 13px) !important;
      letter-spacing: -0.2px;
    }

    .control-form .ant-form-item.mobile-range-time-form .ant-picker-range-separator {
      flex: 0 0 auto;
      min-width: 0;
      padding: 0 2px;
    }

    .control-form .ant-form-item.mobile-range-time-form .ant-picker-suffix {
      flex: 0 0 auto;
      margin-left: 2px;
    }
  }
`;