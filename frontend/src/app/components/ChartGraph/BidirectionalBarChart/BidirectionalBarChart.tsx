import { ChartConfig } from 'app/types/ChartConfig';
import ChartDataSetDTO from 'app/types/ChartDataSet';
import { getColumnRenderName, toFormattedValue } from 'app/utils/chartHelper';
import BasicEChartsChart, { getChartDataParts } from '../BasicEChartsChart';
import { buildBidirectionalData } from '../chartBuilders';
import Config from './config';

export const buildBidirectionalBarOption = (
  dataset: ChartDataSetDTO,
  config: ChartConfig,
) => {
  const { dataSet, groups, metrics } = getChartDataParts(dataset, config);
  const data = buildBidirectionalData(
    dataSet.map(row => ({
      groups: [row.getCell(groups[0]) as string],
      values: metrics.map(metric => Number(row.getCell(metric))),
    })),
  );
  const max = Math.max(
    1,
    ...data.flatMap(item => [Math.abs(item.left), Math.abs(item.right)]),
  );
  const [leftMetric, rightMetric] = metrics;
  return {
    tooltip: {
      trigger: 'axis',
      formatter: params =>
        (Array.isArray(params) ? params : [params])
          .map(param => {
            const metric =
              param.seriesName === getColumnRenderName(rightMetric)
                ? rightMetric
                : leftMetric;
            const original =
              param.data?.original ?? Math.abs(Number(param.value));
            return `${param.axisValue}<br/>${
              param.seriesName
            }: ${toFormattedValue(original, metric?.format)}`;
          })
          .join('<br/>'),
    },
    xAxis: {
      type: 'value',
      min: -max,
      max,
      axisLabel: { formatter: value => Math.abs(value) },
    },
    yAxis: { type: 'category', data: data.map(item => item.name) },
    series: [
      {
        name: getColumnRenderName(leftMetric),
        type: 'bar',
        data: data.map(item => ({
          value: -Math.abs(item.left),
          original: item.left,
          format: leftMetric?.format,
        })),
      },
      {
        name: getColumnRenderName(rightMetric),
        type: 'bar',
        data: data.map(item => ({
          value: Math.abs(item.right),
          original: item.right,
          format: rightMetric?.format,
        })),
      },
    ],
  };
};
class BidirectionalBarChart extends BasicEChartsChart {
  config = Config;
  constructor() {
    super({
      id: 'bidirectional-bar-chart',
      name: 'viz.palette.graph.names.bidirectionalBarChart',
      icon: 'fsux_tubiao_zhuzhuangtu',
      requirements: [{ group: 1, aggregate: 2 }],
    });
  }
  protected getChartOption(dataset: ChartDataSetDTO, config: ChartConfig) {
    return buildBidirectionalBarOption(dataset, config);
  }
}
export default BidirectionalBarChart;
