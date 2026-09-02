import { ChartConfig } from 'app/types/ChartConfig';
import ChartDataSetDTO from 'app/types/ChartDataSet';
import { getStyles } from 'app/utils/chartHelper';
import BasicEChartsChart, { getChartDataParts } from '../BasicEChartsChart';
import { buildRangeData } from '../chartBuilders';
import Config from './config';

export const buildRangeBarOption = (
  dataset: ChartDataSetDTO,
  config: ChartConfig,
) => {
  const { dataSet, groups, metrics } = getChartDataParts(dataset, config);
  const data = buildRangeData(
    dataSet.map(row => ({
      groups: [row.getCell(groups[0]) as string],
      values: metrics.map(metric => Number(row.getCell(metric))),
    })),
  );
  const [horizontal] = getStyles(
    config.styles || [],
    ['chart'],
    ['horizontal'],
  );
  const isHorizontal = horizontal !== false;
  return {
    tooltip: { trigger: 'axis' },
    xAxis: isHorizontal
      ? { type: 'value' }
      : { type: 'category', data: data.map(item => item.name) },
    yAxis: isHorizontal
      ? { type: 'category', data: data.map(item => item.name) }
      : { type: 'value' },
    series: [
      {
        type: 'bar',
        stack: 'range',
        data: data.map(item => item.start),
        itemStyle: { color: 'transparent' },
        silent: true,
      },
      {
        type: 'bar',
        stack: 'range',
        data: data.map(item => item.end - item.start),
      },
    ],
  };
};
class RangeBarChart extends BasicEChartsChart {
  config = Config;
  constructor() {
    super({
      id: 'range-bar-chart',
      name: 'viz.palette.graph.names.rangeBarChart',
      icon: 'fsux_tubiao_zhuzhuangtu',
      requirements: [{ group: 1, aggregate: 2 }],
    });
  }
  protected getChartOption(dataset: ChartDataSetDTO, config: ChartConfig) {
    return buildRangeBarOption(dataset, config);
  }
}
export default RangeBarChart;
