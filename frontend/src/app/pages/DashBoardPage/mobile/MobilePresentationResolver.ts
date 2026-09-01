import { DataViewFieldType, isDateFieldType } from 'app/constants';
import { ChartConfig, ChartDataSectionField } from 'app/types/ChartConfig';
import { getColumnRenderName } from 'app/utils/chartHelper';
import { WidgetData } from '../pages/Board/slice/types';

export type MobileTableDisplayMode =
  | 'auto'
  | 'table'
  | 'card-list'
  | 'kpi-grid'
  | 'ranking-list';

const RANK_LABEL = /rank|ranking|排名|名次/i;
const CITY_LABEL = /city|城市/i;

export const getMobileTableFields = (
  chartConfig?: ChartConfig,
): ChartDataSectionField[] => {
  const sections = chartConfig?.datas || [];
  const mixedFields = sections
    .filter(section => section.key === 'mixed')
    .flatMap(section => section.rows || []);
  return mixedFields.length
    ? mixedFields
    : sections.flatMap(section => section.rows || []);
};

export const isMobileMeasure = (field: ChartDataSectionField) =>
  field.type === DataViewFieldType.NUMERIC || Boolean(field.aggregate);

export const isMobileDimension = (field: ChartDataSectionField) =>
  !isMobileMeasure(field);

export const getMobileFieldLabel = (field: ChartDataSectionField) =>
  getColumnRenderName(field);

export const isMobileRankField = (field: ChartDataSectionField) =>
  RANK_LABEL.test(getMobileFieldLabel(field));

export const isMobileCityField = (field: ChartDataSectionField) =>
  CITY_LABEL.test(getMobileFieldLabel(field));

export function resolveMobileTableDisplayMode(
  data?: Pick<WidgetData, 'rows'>,
  fields: ChartDataSectionField[] = [],
): Exclude<MobileTableDisplayMode, 'auto'> {
  const rows = data?.rows || [];
  const dimensions = fields.filter(isMobileDimension);
  const rankFields = fields.filter(isMobileRankField);
  const measures = fields.filter(
    field => isMobileMeasure(field) && !rankFields.includes(field),
  );
  const isCitySummary =
    rows.length > 1 &&
    dimensions.length === 1 &&
    isMobileCityField(dimensions[0]) &&
    measures.length > 0;
  const hasDateDimension = dimensions.some(field =>
    isDateFieldType(field.type),
  );

  if (rows.length === 1 && measures.length >= 2) {
    return 'kpi-grid';
  }

  if (
    rows.length > 1 &&
    rankFields.length > 0 &&
    measures.length > 0 &&
    dimensions.length <= 2
  ) {
    return 'ranking-list';
  }

  // 城市日报在未选择城市时按指标展示全部城市合计，避免横向表格占满屏幕。
  if (isCitySummary) return 'kpi-grid';

  // 日期明细、字段过多的表格优先保留横向对比能力。
  if (
    rows.length > 1 &&
    dimensions.length > 0 &&
    measures.length > 0 &&
    !hasDateDimension &&
    fields.length <= 7 &&
    dimensions.length <= 2 &&
    measures.length <= 5
  ) {
    return 'card-list';
  }

  return 'table';
}

export function resolveMobilePresentation(
  data: Pick<WidgetData, 'rows'> | undefined,
  chartConfig?: ChartConfig,
  displayMode: MobileTableDisplayMode = 'auto',
): Exclude<MobileTableDisplayMode, 'auto'> {
  if (displayMode !== 'auto') return displayMode;
  return resolveMobileTableDisplayMode(data, getMobileTableFields(chartConfig));
}
