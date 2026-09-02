import { ChartConfig } from 'app/types/ChartConfig';
import ChartDataSetDTO from 'app/types/ChartDataSet';
import { getStyles } from 'app/utils/chartHelper';
import BasicEChartsChart, {
  finiteNumber,
  getChartDataParts,
} from '../BasicEChartsChart';
import Config from './config';

export const buildBulletOption = (
  dataset: ChartDataSetDTO,
  config: ChartConfig,
) => {
  const { dataSet, groups, metrics } = getChartDataParts(dataset, config);
  const [range] = getStyles(config.styles || [], ['chart'], ['range']);
  const max = Math.max(1, finiteNumber(range, 100));
  const rows = dataSet.map(row => ({
    name: `${row.getCell(groups[0]) ?? '未命名'}`,
    measure: finiteNumber(row.getCell(metrics[0])),
    target: metrics[1] ? finiteNumber(row.getCell(metrics[1]), NaN) : NaN,
  }));
  return {
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'value', max },
    yAxis: { type: 'category', data: rows.map(row => row.name) },
    series: [
      {
        name: '区间',
        type: 'bar',
        data: rows.map(() => max),
        barGap: '-100%',
        itemStyle: { color: '#e8ebef' },
        silent: true,
      },
      {
        name: '完成值',
        type: 'bar',
        data: rows.map(row => row.measure),
        itemStyle: { color: '#4e79a7' },
      },
      {
        name: '目标值',
        type: 'scatter',
        data: rows
          .map((row, index) =>
            Number.isFinite(row.target) ? [row.target, index] : null,
          )
          .filter(Boolean),
        symbol: 'rect',
        symbolSize: [3, 20],
        itemStyle: { color: '#222' },
      },
    ],
  };
};
class BulletChart extends BasicEChartsChart {
  config = Config;
  constructor() {
    super({
      id: 'bullet-chart',
      name: 'viz.palette.graph.names.bulletChart',
      icon: 'fsux_tubiao_zhuzhuangtu',
      requirements: [{ group: 1, aggregate: [1, 2] }],
    });
  }
  protected getChartOption(dataset: ChartDataSetDTO, config: ChartConfig) {
    return buildBulletOption(dataset, config);
  }
}
export default BulletChart;
