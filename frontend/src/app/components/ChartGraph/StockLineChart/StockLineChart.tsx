import { ChartConfig } from 'app/types/ChartConfig';
import ChartDataSetDTO from 'app/types/ChartDataSet';
import { getColumnRenderName, getStyles } from 'app/utils/chartHelper';
import BasicEChartsChart, {
  finiteNumber,
  getChartDataParts,
} from '../BasicEChartsChart';
import Config from './config';

export const buildStockLineOption = (
  dataset: ChartDataSetDTO,
  config: ChartConfig,
) => {
  const { dataSet, groups, metrics } = getChartDataParts(dataset, config);
  const rows = dataSet.map(row => [
    row.getCell(groups[0]),
    ...metrics.slice(0, 4).map(metric => finiteNumber(row.getCell(metric))),
  ]);
  const [movingAverage] = getStyles(
    config.styles || [],
    ['chart'],
    ['movingAverage'],
  );
  const closeValues = rows.map(row => Number(row[2]));
  const movingAverageData = closeValues.map((_, index) => {
    if (index < 4) return null;
    const values = closeValues.slice(index - 4, index + 1);
    return values.every(Number.isFinite)
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null;
  });
  const series: any[] = [
    {
      name: getColumnRenderName(metrics[0]),
      type: 'candlestick',
      data: rows.map(row => [row[1], row[2], row[3], row[4]]),
    },
  ];
  if (movingAverage) {
    series.push({
      name: 'MA5',
      type: 'line',
      data: movingAverageData,
      showSymbol: false,
    });
  }
  return {
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: rows.map(row => row[0]) },
    yAxis: { type: 'value', scale: true },
    series,
  };
};
class StockLineChart extends BasicEChartsChart {
  config = Config;
  constructor() {
    super({
      id: 'stock-line-chart',
      name: 'viz.palette.graph.names.stockLineChart',
      icon: 'fsux_zhexiantu',
      requirements: [{ group: 1, aggregate: 4 }],
    });
  }
  protected getChartOption(dataset: ChartDataSetDTO, config: ChartConfig) {
    return buildStockLineOption(dataset, config);
  }
}
export default StockLineChart;
