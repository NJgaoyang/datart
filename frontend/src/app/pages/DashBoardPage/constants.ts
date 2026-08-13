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
import { ControllerFacadeTypes } from 'app/constants';
import {
  BackgroundConfig,
  BorderConfig,
  JumpTargetType,
} from 'app/pages/DashBoardPage/pages/Board/slice/types';
import { FilterSqlOperator, TIME_FORMATTER } from 'globalConstants';
import i18next from 'i18next';
import { PRIMARY, WHITE } from 'styles/StyleConstants';
import { WidgetType } from './pages/Board/slice/types';
import { ITimeDefault } from './types/widgetTypes';
export const WIDGET_DRAG_HANDLE = 'widget-draggableHandle';
export const BOARD_FILE_IMG_PREFIX = 'resources/image/dashboard/';
export const BASE_VIEW_WIDTH = 1024;
/** Auto-board layout versions are independent from the application config version. */
export const AUTO_LAYOUT_VERSION = 2;
export const LEGACY_AUTO_LAYOUT_VERSION = 1;
export const LEGACY_AUTO_GRID_COLS = 12;
export const AUTO_GRID_COLS = 72;
export const LEGACY_BASE_ROW_HEIGHT = 32;
export const PC_ROW_LAYOUT_VERSION = 2;
export const LEGACY_PC_ROW_LAYOUT_VERSION = 1;
export const LEGACY_MOBILE_GRID_COLS = 6;
export const MOBILE_GRID_COLS = 24;
export const LEGACY_MOBILE_LAYOUT_VERSION = 1;
export const MOBILE_LAYOUT_VERSION = 2;
export const BASE_ROW_HEIGHT = 8;
export const MIN_ROW_HEIGHT = 6;
export const MOBILE_ROW_HEIGHT = 24;
export const MIN_MARGIN = 8;
export const MIN_PADDING = 8;
export const MOBILE_MIN_MARGIN = 2;
export const MOBILE_MIN_PADDING = 4;
export const LAYOUT_COLS_KEYS = ['lg', 'md', 'sm', 'xs', 'xxs'] as const;
export const LAYOUT_COLS_MAP = {
  lg: AUTO_GRID_COLS,
  md: AUTO_GRID_COLS,
  sm: MOBILE_GRID_COLS,
  xs: MOBILE_GRID_COLS,
  xxs: MOBILE_GRID_COLS,
};

export const BREAK_POINT_MAP = {
  lg: 1200,
  md: 996,
  sm: 768,
  xs: 480,
  xxs: 0,
};

export const INIT_COLS = AUTO_GRID_COLS;
// DASH_UNDO
export const BOARD_UNDO = {
  undo: 'EDITOR_UNDO',
  redo: 'EDITOR_REDO',
};

export const ORIGINAL_TYPE_MAP = {
  group: 'group',
  linkedChart: 'linkedChart',
  ownedChart: 'ownedChart',

  tab: 'tab',

  image: 'image',
  video: 'video',
  timer: 'timer',
  richText: 'richText',
  iframe: 'iframe',

  queryBtn: 'queryBtn',
  resetBtn: 'resetBtn',

  dropdownList: ControllerFacadeTypes.DropdownList,
  multiDropdownList: ControllerFacadeTypes.MultiDropdownList,
  checkboxGroup: ControllerFacadeTypes.CheckboxGroup,
  radioGroup: ControllerFacadeTypes.RadioGroup,
  text: ControllerFacadeTypes.Text,
  time: ControllerFacadeTypes.Time,
  rangeTime: ControllerFacadeTypes.RangeTime,
  rangeValue: ControllerFacadeTypes.RangeValue,
  value: ControllerFacadeTypes.Value,
  slider: ControllerFacadeTypes.Slider,
  dropDownTree: ControllerFacadeTypes.DropDownTree,

  // custom: 'custom', TODO:
};

export const BackgroundDefault: BackgroundConfig = {
  color: 'transparent',
  image: '',
  size: '100% 100%', // 'auto' | 'contain' | 'cover'|,
  repeat: 'no-repeat', //'repeat' | 'repeat-x' | 'repeat-y' | 'no-repeat',
};

export const AutoBoardWidgetBackgroundDefault: BackgroundConfig = {
  ...BackgroundDefault,
  color: WHITE,
};

export const AutoBoardBackgroundDefault: BackgroundConfig = {
  ...BackgroundDefault,
  color: '#F0F2F5',
};

export const QueryButtonWidgetBackgroundDefault: BackgroundConfig = {
  ...BackgroundDefault,
  color: PRIMARY,
};
export const TimeDefault: ITimeDefault = {
  format: TIME_FORMATTER,
  duration: 1000,
};
export const BorderDefault: BorderConfig = {
  radius: 8,
  width: 1,
  style: 'solid',
  color: '#f0f0f0',
};

export const ButtonBorderDefault: BorderConfig = {
  ...BorderDefault,
  width: 0,
};

export const CanDropToWidgetTypes: readonly WidgetType[] = ['chart', 'media'];

export const CONTAINER_TAB = 'containerTab';

// setting

export const TEXT_ALIGNS = ['left', 'center', 'right'] as const;
export type TextAlignType = typeof TEXT_ALIGNS[number];

export const BORDER_STYLES = [
  'none',
  'solid',
  'dashed',
  'dotted',
  'double',
  'hidden',
  'groove',
  'ridge',
  'inset',
  'outset',
] as const;
export type BorderStyleType = typeof BORDER_STYLES[number];

export const SCALE_MODES = [
  'scaleWidth',
  'scaleHeight',
  'scaleFull',
  'noScale',
] as const;

export type ScaleModeType = typeof SCALE_MODES[number];

export const enum ValueOptionTypes {
  Common = 'common',
  Custom = 'custom',
}
export type ValueOptionType = Uncapitalize<keyof typeof ValueOptionTypes>;
export const OPERATOR_TYPE_OPTION = [
  { name: '常规', value: ValueOptionTypes.Common },
  { name: '自定义', value: ValueOptionTypes.Custom },
];

export const enum ControllerVisibleTypes {
  Show = 'show',
  Hide = 'hide',
  Condition = 'condition',
}
export type ControllerVisibleType = Uncapitalize<
  keyof typeof ControllerVisibleTypes
>;
const tfo = (operator: FilterSqlOperator) => {
  const preStr = 'viz.common.enum.filterOperator.';
  return i18next.t(preStr + operator);
};
const tft = (type: ControllerVisibleTypes) => {
  const preStr = 'viz.common.enum.controllerVisibilityTypes.';
  return i18next.t(preStr + type);
};
const getVisibleOptionItem = (type: ControllerVisibleTypes) => {
  return {
    name: tft(type),
    value: type,
  };
};
const getOperatorItem = (value: FilterSqlOperator) => {
  return {
    name: tfo(value),
    value: value,
  };
};
export const VISIBILITY_TYPE_OPTION = [
  getVisibleOptionItem(ControllerVisibleTypes.Show),
  getVisibleOptionItem(ControllerVisibleTypes.Hide),
  getVisibleOptionItem(ControllerVisibleTypes.Condition),
];
export const ALL_SQL_OPERATOR_OPTIONS = [
  getOperatorItem(FilterSqlOperator.Equal),
  getOperatorItem(FilterSqlOperator.NotEqual),

  getOperatorItem(FilterSqlOperator.In),
  getOperatorItem(FilterSqlOperator.NotIn),

  getOperatorItem(FilterSqlOperator.Null),
  getOperatorItem(FilterSqlOperator.NotNull),

  getOperatorItem(FilterSqlOperator.Contain),
  getOperatorItem(FilterSqlOperator.NotContain),

  getOperatorItem(FilterSqlOperator.PrefixContain),
  getOperatorItem(FilterSqlOperator.NotPrefixContain),

  getOperatorItem(FilterSqlOperator.SuffixContain),
  getOperatorItem(FilterSqlOperator.NotSuffixContain),

  getOperatorItem(FilterSqlOperator.Between),

  getOperatorItem(FilterSqlOperator.GreaterThanOrEqual),
  getOperatorItem(FilterSqlOperator.LessThanOrEqual),
  getOperatorItem(FilterSqlOperator.GreaterThan),
  getOperatorItem(FilterSqlOperator.LessThan),
];

export const SQL_OPERATOR_OPTIONS_TYPES = {
  [ControllerFacadeTypes.DropdownList]: [
    FilterSqlOperator.Equal,
    FilterSqlOperator.NotEqual,
  ],
  [ControllerFacadeTypes.MultiDropdownList]: [
    FilterSqlOperator.In,
    FilterSqlOperator.NotIn,
  ],
  [ControllerFacadeTypes.CheckboxGroup]: [
    FilterSqlOperator.In,
    FilterSqlOperator.NotIn,
  ],
  [ControllerFacadeTypes.RadioGroup]: [
    FilterSqlOperator.Equal,
    FilterSqlOperator.NotEqual,
  ],
  [ControllerFacadeTypes.Text]: [
    FilterSqlOperator.Equal,
    FilterSqlOperator.NotEqual,
    FilterSqlOperator.Contain,
    FilterSqlOperator.NotContain,
    FilterSqlOperator.PrefixContain,
    FilterSqlOperator.NotPrefixContain,
    FilterSqlOperator.SuffixContain,
    FilterSqlOperator.NotSuffixContain,
  ],
  [ControllerFacadeTypes.Value]: [
    FilterSqlOperator.Equal,
    FilterSqlOperator.NotEqual,
    FilterSqlOperator.LessThan,
    FilterSqlOperator.GreaterThan,
    FilterSqlOperator.LessThanOrEqual,
    FilterSqlOperator.GreaterThanOrEqual,
  ],
  [ControllerFacadeTypes.Time]: [
    FilterSqlOperator.Equal,
    FilterSqlOperator.NotEqual,
    FilterSqlOperator.LessThan,
    FilterSqlOperator.GreaterThan,
    FilterSqlOperator.LessThanOrEqual,
    FilterSqlOperator.GreaterThanOrEqual,
  ],
  [ControllerFacadeTypes.Slider]: [
    FilterSqlOperator.Equal,
    FilterSqlOperator.NotEqual,
    FilterSqlOperator.LessThan,
    FilterSqlOperator.GreaterThan,
    FilterSqlOperator.LessThanOrEqual,
    FilterSqlOperator.GreaterThanOrEqual,
  ],
  [ControllerFacadeTypes.DropDownTree]: [
    FilterSqlOperator.In,
    FilterSqlOperator.NotIn,
  ],
};

export const WIDGET_TITLE_ALIGN_OPTIONS = [
  { name: '左', value: TEXT_ALIGNS[0] },
  { name: '中', value: TEXT_ALIGNS[1] },
];

export const DefaultWidgetData = {
  id: '',
  columns: [],
  rows: [],
};

export const jumpTypes: { name: string; value: JumpTargetType }[] = [
  { value: 'INTERNAL', name: '' },
  { value: 'URL', name: '' },
];
