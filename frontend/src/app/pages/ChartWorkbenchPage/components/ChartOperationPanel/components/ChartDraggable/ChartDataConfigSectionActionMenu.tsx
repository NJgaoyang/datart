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

import { CheckOutlined } from '@ant-design/icons';
import { Menu } from 'antd';
import {
  AggregateFieldActionType,
  AggregateFieldSubAggregateType,
  ChartDataSectionFieldActionType,
  ChartDataViewFieldCategory,
  DataViewFieldType,
  SortActionType,
} from 'app/constants';
import useI18NPrefix from 'app/hooks/useI18NPrefix';
import { ChartDataSectionField } from 'app/types/ChartConfig';
import { ChartDataConfigSectionProps } from 'app/types/ChartDataConfigSection';
import { ChartDataViewMeta } from 'app/types/ChartDataViewMeta';
import { FC } from 'react';
import { isEmpty } from 'utils/object';
import { buildDateLevelMenuItems } from '../ChartFieldAction/DateLevelAction/DateLevelMenuItems';
import { updateDataConfigByField } from './utils';

const ChartDataConfigSectionActionMenu: FC<
  {
    uid: string;
    type: string;
    metas?: ChartDataViewMeta[];
    onOpenModal;
    availableSourceFunctions?: string[];
  } & ChartDataConfigSectionProps
> = ({
  uid,
  type,
  onOpenModal,
  ancestors,
  config,
  availableSourceFunctions,
  category,
  metas,
  onConfigChanged,
}) => {
  const t = useI18NPrefix(`viz.palette.data.enum.actionType`);
  const subMenuAction = [
    ChartDataSectionFieldActionType.Sortable,
    ChartDataSectionFieldActionType.Aggregate,
    ChartDataSectionFieldActionType.AggregateLimit,
    ChartDataSectionFieldActionType.DateLevel,
  ];

  const handleFieldConfigChanged = (
    columnUid: string,
    fieldConfig: ChartDataSectionField,
    needRefresh?: boolean,
    replacedConfig?: ChartDataSectionField,
  ) => {
    if (!fieldConfig) {
      return;
    }
    const newConfig = updateDataConfigByField(
      columnUid,
      config,
      fieldConfig,
      replacedConfig,
    );

    onConfigChanged?.(ancestors, newConfig, needRefresh);
  };

  const getModalActions = (actions, type, category) => {
    return getActionsByTypeAndCategory(actions, type, category)?.filter(
      a => !subMenuAction.includes(a),
    );
  };

  const getSubMenuActions = (actions, type, category) => {
    return getActionsByTypeAndCategory(actions, type, category)?.filter(a =>
      subMenuAction.includes(a),
    );
  };

  const getActionsByTypeAndCategory = (actions, type, category) => {
    let modalActions: string[] = [];
    if (Array.isArray(actions)) {
      modalActions = actions;
    } else if (type in actions) {
      modalActions = actions[type] as string[];
    }

    if (category === ChartDataViewFieldCategory.AggregateComputedField) {
      modalActions = modalActions.filter(
        action =>
          ![
            ChartDataSectionFieldActionType.Aggregate,
            ChartDataSectionFieldActionType.AggregateLimit,
          ].includes(action),
      );
    }

    if (
      type === 'DATE' &&
      ![
        ChartDataViewFieldCategory.Field,
        ChartDataViewFieldCategory.DateLevelComputedField,
      ].includes(category)
    ) {
      modalActions = modalActions.filter(
        action => ![ChartDataSectionFieldActionType.DateLevel].includes(action),
      );
    }

    return modalActions;
  };

  const sortT = useI18NPrefix('viz.palette.data.actions');
  const aggregateT = useI18NPrefix('viz.common.enum.aggregateTypes');
  const dateT = useI18NPrefix('viz.workbench.dataview');
  const getSubMenuItems = actionName => {
    const field = config.rows?.find(row => row.uid === uid);
    if (!field) return [];
    const update = (value, refresh = true) =>
      handleFieldConfigChanged(uid, value, refresh);
    if (actionName === ChartDataSectionFieldActionType.DateLevel) {
      return buildDateLevelMenuItems(
        {
          config: field,
          metas,
          availableSourceFunctions,
          onChange: value => handleFieldConfigChanged(uid, value, true, field),
        },
        dateT,
      );
    }
    if (actionName === ChartDataSectionFieldActionType.Sortable) {
      const backendSort = config.options?.[actionName]?.backendSort;
      return [SortActionType.None, SortActionType.ASC, SortActionType.DESC].map(
        direction => ({
          key: direction,
          label: sortT(`sort.${direction.toLowerCase()}`),
          icon:
            (field.sort?.type || SortActionType.None) === direction ? (
              <CheckOutlined />
            ) : undefined,
          onClick: () =>
            update(
              { ...field, sort: { type: direction } },
              isEmpty(backendSort) ? true : Boolean(backendSort),
            ),
        }),
      );
    }
    return (AggregateFieldSubAggregateType[actionName] || []).map(
      aggregate => ({
        key: aggregate,
        label: aggregateT(aggregate),
        icon:
          actionName === ChartDataSectionFieldActionType.Aggregate &&
          field.aggregate === aggregate ? (
            <CheckOutlined />
          ) : undefined,
        onClick: () => update({ ...field, aggregate }),
      }),
    );
  };

  const metric = config.rows?.find(row => row.uid === uid);
  // Persisted chart fields commonly omit the computed expression text:
  // it lives in dataView.computedFields. Do not hide the explicit metric
  // option merely because the chart copy only carries its stable fieldId.
  const canConfigureRatio =
    type === DataViewFieldType.NUMERIC &&
    metric?.aggregate === AggregateFieldActionType.Sum &&
    category === ChartDataViewFieldCategory.ComputedField.toLowerCase();

  return (
    <Menu
      items={[
        ...(canConfigureRatio && metric
          ? [
              {
                key: 'ratioOfSums',
                onClick: () =>
                  handleFieldConfigChanged(
                    uid,
                    { ...metric, ratioOfSums: !metric.ratioOfSums },
                    true,
                  ),
                label: metric.ratioOfSums
                  ? '✓ 汇总比率：先求和后相除'
                  : '汇总比率：先求和后相除',
              },
            ]
          : []),
        ...getModalActions(config?.actions, type, category).map(actionName => ({
          key: actionName,
          onClick: () => onOpenModal(uid)(actionName),
          label: t(actionName),
        })),
        ...getSubMenuActions(config?.actions, type, category).map(
          actionName => ({
            key: actionName,
            label: t(actionName),
            children: getSubMenuItems(actionName),
          }),
        ),
      ]}
    />
  );
};

export default ChartDataConfigSectionActionMenu;
