import { ChartConfig } from 'app/types/ChartConfig';
import ChartDataSetDTO from 'app/types/ChartDataSet';
import { getStyles } from 'app/utils/chartHelper';
import BasicEChartsChart, { getChartDataParts } from '../BasicEChartsChart';
import { buildProgressData } from '../chartBuilders';
import Config from './config';

export const buildProgressBarOption = (
  dataset: ChartDataSetDTO,
  config: ChartConfig,
) => {
  const { dataSet, groups, metrics } = getChartDataParts(dataset, config);
  const [max] = getStyles(config.styles || [], ['chart'], ['max']);
  const data = buildProgressData(
    dataSet.map(row => ({
      groups: [row.getCell(groups[0]) as string],
      values: [Number(row.getCell(metrics[0]))],
    })),
    Math.max(0, Number(max ?? 100)),
  );
  const axisMax = Math.max(
    100,
    ...data.map(item => item.max),
    ...data.map(item => item.value),
  );
  return {
    tooltip: { trigger: 'axis', valueFormatter: value => `${value}%` },
    xAxis: { type: 'value', max: axisMax },
    yAxis: { type: 'category', data: data.map(item => item.name) },
    series: [
      {
        type: 'bar',
        data: data.map(item => item.value),
        showBackground: true,
        backgroundStyle: { color: '#edf0f2' },
        label: { show: true, formatter: params => `${params.value}%` },
      },
    ],
  };
};
class ProgressBarChart extends BasicEChartsChart {
  config = Config;
  constructor() {
    super({
      id: 'progress-bar-chart',
      name: 'viz.palette.graph.names.progressBarChart',
      icon: 'fsux_tubiao_zhuzhuangtu',
      requirements: [{ group: 1, aggregate: 1 }],
    });
  }
  protected getChartOption(dataset: ChartDataSetDTO, config: ChartConfig) {
    return buildProgressBarOption(dataset, config);
  }
}
export default ProgressBarChart;
