import { ChartConfig, ChartStyleConfig } from 'app/types/ChartConfig';
import ChartDataSetDTO from 'app/types/ChartDataSet';
import {
  getExtraSeriesRowData,
  getColumnRenderName,
  getStyles,
  getSelectedItemStyles,
  toFormattedValue,
} from 'app/utils/chartHelper';
import BasicEChartsChart, {
  finiteNumber,
  getChartDataParts,
  safeName,
} from '../BasicEChartsChart';
import Config from './config';

const getStyle = (styles: ChartStyleConfig[], key: string, fallback: any) => {
  const [value] = getStyles(styles, ['radar'], [key]);
  return value === undefined ? fallback : value;
};

export const buildRadarOption = (
  dataset: ChartDataSetDTO,
  config: ChartConfig,
  selectedItems: any[] = [],
) => {
  const { dataSet, groups, metrics } = getChartDataParts(dataset, config);
  const styles = config.styles || [];
  const labels = dataSet.flatMap(row =>
    metrics.map(metric => finiteNumber(row.getCell(metric))),
  );
  const indicator = metrics.map(metric => ({
    name: getColumnRenderName(metric),
    max: Math.max(1, ...labels.map(value => Math.abs(value))),
  }));
  const series = groups.length
    ? dataSet.map((row, index) => ({
        name: safeName(row.getCell(groups[0]), `系列 ${index + 1}`),
        type: 'radar',
        data: [
          {
            ...getExtraSeriesRowData(row),
            ...getSelectedItemStyles(index, 0, selectedItems),
            value: metrics.map(metric => finiteNumber(row.getCell(metric))),
            name: safeName(row.getCell(groups[0]), `系列 ${index + 1}`),
          },
        ],
      }))
    : [
        {
          name: getColumnRenderName(metrics[0]),
          type: 'radar',
          data: [
            {
              ...(dataSet[0]
                ? getExtraSeriesRowData(dataSet[0])
                : { rowData: {} }),
              ...getSelectedItemStyles(0, 0, selectedItems),
              value: dataSet[0]
                ? metrics.map(metric =>
                    finiteNumber(dataSet[0].getCell(metric)),
                  )
                : metrics.map(() => 0),
              name: getColumnRenderName(metrics[0]),
            },
          ],
        },
      ];
  const showLabel = getStyles(styles, ['label'], ['showLabel'])[0] ?? true;
  const showLegend = getStyles(styles, ['legend'], ['showLegend'])[0] ?? true;
  const shape = getStyle(styles, 'shape', 'polygon');
  const radius = getStyle(styles, 'radius', '65%');
  const font = getStyles(styles, ['label'], ['font'])[0] || {};
  return {
    tooltip: {
      trigger: 'item',
      formatter: params => {
        const values = params?.value || [];
        return [
          params?.name,
          ...values.map(
            (value, i) =>
              `${indicator[i]?.name}: ${toFormattedValue(
                value,
                metrics[i]?.format,
              )}`,
          ),
        ]
          .filter(Boolean)
          .join('<br/>');
      },
    },
    legend: { show: showLegend, data: series.map(item => item.name) },
    radar: {
      shape,
      radius,
      indicator,
      name: font,
    },
    series: series.map(item => ({
      ...item,
      label: { show: showLabel, ...font },
    })),
  };
};

class BasicRadarChart extends BasicEChartsChart {
  config = Config;

  constructor(props?) {
    super({
      id: props?.id || 'radar',
      name: props?.name || 'viz.palette.graph.names.radarChart',
      icon: props?.icon || 'radar',
      requirements: props?.requirements || [
        { group: [0, 1], aggregate: [1, 999] },
      ],
    });
  }

  protected getChartOption(
    dataset: ChartDataSetDTO,
    config: ChartConfig,
    selectedItems?: any[],
  ) {
    return buildRadarOption(dataset, config, selectedItems);
  }
}

export default BasicRadarChart;
