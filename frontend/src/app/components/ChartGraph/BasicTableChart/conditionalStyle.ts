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

import { ConditionalStyleFormValues } from 'app/components/FormGenerator/Customize/ConditionalStyle';
import { OperatorTypes } from 'app/components/FormGenerator/Customize/ConditionalStyle/types';
import { CSSProperties } from 'react';

export const getHeatmapColor = (
  value: unknown,
  min: number,
  max: number,
  start = '#eef5ff',
  end = '#2f6fed',
): string | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return undefined;
  const ratio =
    min === max
      ? 0.5
      : Math.max(0, Math.min(1, (numberValue - min) / (max - min)));
  const parse = color => {
    const hex = color.replace('#', '');
    return [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16));
  };
  const [r1, g1, b1] = parse(start);
  const [r2, g2, b2] = parse(end);
  return `rgb(${Math.round(r1 + (r2 - r1) * ratio)}, ${Math.round(
    g1 + (g2 - g1) * ratio,
  )}, ${Math.round(b1 + (b2 - b1) * ratio)})`;
};

const isMatchedTheCondition = (
  value: string | number,
  operatorType: OperatorTypes,
  conditionValues: string | number | (string | number)[],
) => {
  let matchTheCondition = false;

  switch (operatorType) {
    case OperatorTypes.Equal:
      matchTheCondition = value === conditionValues;
      break;
    case OperatorTypes.NotEqual:
      matchTheCondition = value !== conditionValues;
      break;
    case OperatorTypes.Contain:
      matchTheCondition = (value as string)?.includes(
        conditionValues as string,
      );
      break;
    case OperatorTypes.NotContain:
      matchTheCondition = !(value as string)?.includes(
        conditionValues as string,
      );
      break;
    case OperatorTypes.In:
      matchTheCondition = (conditionValues as (string | number)[])?.includes(
        value,
      );
      break;
    case OperatorTypes.NotIn:
      matchTheCondition = !(conditionValues as (string | number)[])?.includes(
        value,
      );
      break;
    case OperatorTypes.Between:
      const [min, max] = conditionValues as number[];
      matchTheCondition = (value as number) >= min && (value as number) <= max;
      break;
    case OperatorTypes.LessThan:
      matchTheCondition = value < conditionValues;
      break;
    case OperatorTypes.GreaterThan:
      matchTheCondition = value > conditionValues;
      break;
    case OperatorTypes.LessThanOrEqual:
      matchTheCondition = value <= conditionValues;
      break;
    case OperatorTypes.GreaterThanOrEqual:
      matchTheCondition = value >= conditionValues;
      break;
    case OperatorTypes.IsNull:
      if (typeof value === 'object' && value === null) {
        matchTheCondition = true;
      } else if (typeof value === 'string' && value === '') {
        matchTheCondition = true;
      } else if (typeof value === 'undefined') {
        matchTheCondition = true;
      } else {
        matchTheCondition = false;
      }
      break;
    default:
      break;
  }
  return matchTheCondition;
};

const getTheSameRange = (list, type) =>
  list?.filter(item => item?.range === type);

const deleteUndefinedProps = props => {
  return Object.keys(props).reduce((acc, cur) => {
    if (props[cur] !== undefined || props[cur] !== null) {
      acc[cur] = props[cur];
    }
    return acc;
  }, {});
};

export const getCustomBodyCellStyle = (
  cellValue: any,
  conditionalStyle: ConditionalStyleFormValues[],
): CSSProperties => {
  const currentConfigs = getTheSameRange(conditionalStyle, 'cell');
  if (!currentConfigs?.length) {
    return {};
  }
  const text = cellValue;
  let cellStyle: CSSProperties = {};

  try {
    currentConfigs?.forEach(
      ({ operator, value, color: { background, textColor: color } }) => {
        cellStyle = isMatchedTheCondition(text, operator, value)
          ? { backgroundColor: background, color }
          : cellStyle;
      },
    );
  } catch (error) {
    console.error('getCustomBodyCellStyle | error ', error);
  }
  return deleteUndefinedProps(cellStyle);
};

export const getCustomBodyRowStyle = (
  rowRecord: { [k in string]: any },
  conditionalStyle: ConditionalStyleFormValues[],
): CSSProperties => {
  const currentConfigs: ConditionalStyleFormValues[] = getTheSameRange(
    conditionalStyle,
    'row',
  );
  if (!currentConfigs?.length) {
    return {};
  }
  let rowStyle: CSSProperties = {};

  try {
    currentConfigs?.forEach(
      ({
        operator,
        value,
        color: { background, textColor },
        target: { name },
      }) => {
        rowStyle = isMatchedTheCondition(rowRecord?.[name], operator, value)
          ? { backgroundColor: background, color: textColor }
          : rowStyle;
      },
    );
  } catch (error) {
    console.error('getCustomBodyRowStyle | error ', error);
  }
  return deleteUndefinedProps(rowStyle);
};
