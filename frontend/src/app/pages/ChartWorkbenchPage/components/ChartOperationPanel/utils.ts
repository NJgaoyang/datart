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
  ChartDataViewFieldCategory,
  DataViewFieldType,
  isDateFieldType,
} from 'app/constants';
import { FieldTemplate } from 'app/pages/ChartWorkbenchPage/components/ChartOperationPanel/components/ChartDataViewPanel/components/utils';
import { ColumnRole } from 'app/pages/MainPage/pages/ViewPage/slice/types';
import { ChartDataSectionField } from 'app/types/ChartConfig';
import { ChartDataViewMeta } from 'app/types/ChartDataViewMeta';
import { updateBy } from 'app/utils/mutation';
import { DATE_LEVEL_DELIMITER } from 'globalConstants';
import i18n from 'i18next';
import { CloneValueDeep } from 'utils/object';
import { getDatasetFieldDisplayName } from 'utils/utils';
import { DATE_LEVELS } from '../../slice/constant';

export const getAllFieldsOfEachType = (args: {
  sortType;
  dataView;
  availableSourceFunctions;
}) => {
  const { sortType, dataView, availableSourceFunctions } = args;
  const computedFields =
    dataView?.computedFields?.filter(
      v => v.category !== ChartDataViewFieldCategory.DateLevelComputedField,
    ) || [];
  const allFields = dataView?.meta || [];

  let hierarchyFields = allFields.filter(f => f.role === ColumnRole.Hierarchy);

  const allNoHierarchyFields = fieldsSortByType(
    allFields.filter(f => f.role !== ColumnRole.Hierarchy),
    sortType,
  );
  const stringFields = allNoHierarchyFields.filter(
    f => f.type === DataViewFieldType.STRING,
  );
  const numericFields = allNoHierarchyFields.filter(
    f => f.type === DataViewFieldType.NUMERIC,
  );
  const dateFields =
    allNoHierarchyFields.filter(f => isDateFieldType(f.type)) || [];
  const dateLevelFields = buildDateLevelFields({
    dateFields,
    availableSourceFunctions,
  });
  const stringComputedFields = computedFields.filter(
    f => f.type === DataViewFieldType.STRING,
  );
  const numericComputedFields = computedFields.filter(
    f => f.type === DataViewFieldType.NUMERIC,
  );
  const dateComputedFields = computedFields.filter(f =>
    isDateFieldType(f.type),
  );
  hierarchyFields = updateBy(hierarchyFields, draft => {
    draft.forEach((v, i) => {
      draft[i].children = buildDateLevelFields({
        dateFields: v.children,
        availableSourceFunctions,
      });
    });
  });

  return {
    allFields,
    computedFields,
    hierarchyFields,
    allNoHierarchyFields,
    stringFields,
    numericFields,
    dateLevelFields,
    stringComputedFields,
    numericComputedFields,
    dateComputedFields,
  };
};

export const buildDateLevelFields = (args: {
  dateFields;
  availableSourceFunctions: string[];
}) => {
  const { dateFields, availableSourceFunctions } = args;
  return updateBy(dateFields, draft => {
    draft.forEach(v => {
      if (!isDateFieldType(v.type)) {
        return false;
      }
      v.children = DATE_LEVELS.map((item, i) => {
        if (item.datetimeOnly && v.type !== DataViewFieldType.DATETIME) {
          return null;
        }
        const nativeExpression = `${item.expression}_NATIVE`;
        const expression = availableSourceFunctions?.includes(nativeExpression)
          ? nativeExpression
          : item.expression;
        if (
          availableSourceFunctions &&
          availableSourceFunctions.includes(expression)
        ) {
          return {
            name: v.name + DATE_LEVEL_DELIMITER + expression,
            fieldId: v.fieldId,
            originName: v.originName,
            field: v.name,
            type: item.type,
            category: item.category,
            expression: `${expression}(${FieldTemplate(v.path)})`,
            path: v.path,
            displayName: v.displayName,
            comment: v.comment,
            isDisplayNameCustom: v.isDisplayNameCustom,
          };
        }
        return null;
      }).filter(Boolean);
    });
  });
};
export const fieldsSortByType = (fields, sortType) => {
  return fields.sort((a, b) => {
    if (sortType === 'byNameSort') {
      return getDatasetFieldDisplayName(a).localeCompare(
        getDatasetFieldDisplayName(b),
        'zh-CN',
      );
    } else {
      return null;
    }
  });
};

export const getCanReplaceViewFields = (
  viewFields: ChartDataViewMeta[],
  target: ChartDataSectionField,
) => {
  const sameTypeViewFields = getSameTypeViewFields(
    CloneValueDeep(viewFields),
    target.type,
  );
  const canReplaceViewFields = getSameCategoryViewFields(
    sameTypeViewFields,
    target.category,
  );
  return canReplaceViewFields;
};
// export const getCanReplaceViewFields
export const getSameTypeViewFields = (
  viewFields: ChartDataViewMeta[],
  type: ChartDataSectionField['type'],
) => {
  return viewFields
    .map(item => {
      if (item.children && item.children.length) {
        item.children = getSameTypeViewFields(
          item.children,
          type,
        ) as ChartDataViewMeta[];
        return item;
      }
      if (item.type === type) {
        return item;
      }
      return undefined;
    })
    .filter(item => !!item) as ChartDataViewMeta[];
};

export const getSameCategoryViewFields = (
  viewFields: ChartDataViewMeta[],
  category: ChartDataSectionField['category'],
) => {
  return viewFields
    .map(item => {
      if (item.children && item.children.length) {
        item.children = getSameCategoryViewFields(
          item.children,
          category,
        ) as ChartDataViewMeta[];
        return item;
      }
      if (item.category === category) {
        return item;
      }
      return undefined;
    })
    .filter(item => !!item) as ChartDataViewMeta[];
};

export const findSameFieldInView = (
  viewFields: ChartDataViewMeta[],
  field: ChartDataSectionField,
) => {
  const item = viewFields.find(item => {
    let bool = false;
    if (item.children && item.children.length) {
      bool = findSameFieldInView(item.children, field);
    }
    if (bool) return true;

    if (
      item.name === field.colName &&
      item.category === field.category &&
      item.type === field.type
    ) {
      bool = true;
    }
    return bool;
  });
  if (item) return true;

  return false;
};

export const handleDateLevelsName = (
  col: {
    name: string;
    field?: string;
    originName?: string;
    path?: string[];
    category: string;
    displayName?: string;
    comment?: string;
    isDisplayNameCustom?: boolean;
  },
  parentDisplayName?: string,
): string => {
  if (col.category === ChartDataViewFieldCategory.DateLevelComputedField) {
    const prefix = 'viz.workbench.dataview.';
    const colList = col.name.split(DATE_LEVEL_DELIMITER);
    const levelName = i18n.t(prefix + colList[1].replace(/_NATIVE$/, ''));
    const levelSuffix = `（${levelName}）`;
    if (col.displayName?.endsWith(levelSuffix)) {
      const sourceDisplayName = col.displayName.slice(0, -levelSuffix.length);
      return `${
        parentDisplayName ||
        getDatasetFieldDisplayName({
          originName: col.originName || col.field || colList[0],
          name: col.field || colList[0],
          path: col.path,
          displayName: sourceDisplayName,
          comment: col.comment,
          isDisplayNameCustom: col.isDisplayNameCustom,
        })
      }${levelSuffix}`;
    }
    return `${
      parentDisplayName ||
      getDatasetFieldDisplayName({
        originName: col.originName || col.field || colList[0],
        name: col.field || colList[0],
        path: col.path,
        displayName: col.displayName,
        comment: col.comment,
        isDisplayNameCustom: col.isDisplayNameCustom,
      })
    }${levelSuffix}`;
  } else {
    return getDatasetFieldDisplayName({
      originName: col.originName || col.field || col.name,
      name: col.name,
      path: col.path,
      displayName: col.displayName,
    });
  }
};
