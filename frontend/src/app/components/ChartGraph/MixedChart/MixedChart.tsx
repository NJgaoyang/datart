import { ChartConfig } from 'app/types/ChartConfig';
import ChartDataSetDTO from 'app/types/ChartDataSet';
import { getColumnRenderName, getStyles } from 'app/utils/chartHelper';
import BasicEChartsChart, { getChartDataParts } from '../BasicEChartsChart';
import Config from './config';

export type MixedMode = 'bar-line' | 'group' | 'stack' | 'dual-line';
export const buildMixedOption = (
  dataset: ChartDataSetDTO,
  config: ChartConfig,
  mode: MixedMode,
) => {
  const { dataSet, groups } = getChartDataParts(dataset, config);
  const metricSections = (config.datas || []).filter(
    section => section.type === 'aggregate',
  );
  const leftMetrics = metricSections
    .filter(section => section.key === 'metricsL')
    .flatMap(section => section.rows || []);
  const rightMetrics = metricSections
    .filter(section => section.key === 'metricsR')
    .flatMap(section => section.rows || []);
  const metrics = leftMetrics.concat(rightMetrics);
  const categories = dataSet.map(row => row.getCell(groups[0]));
  const [smooth] = getStyles(config.styles || [], ['chart'], ['smooth']);
  const makeSeries = (metric, index) => {
    const isRight = index >= leftMetrics.length;
    return {
      name: metric ? getColumnRenderName(metric) : `指标${index + 1}`,
      type:
        mode === 'dual-line' || (mode === 'bar-line' && isRight)
          ? 'line'
          : 'bar',
      yAxisIndex: isRight ? 1 : 0,
      stack:
        mode === 'stack' ? `axis-${isRight ? 'right' : 'left'}` : undefined,
      smooth: Boolean(smooth) || mode === 'dual-line',
      data: dataSet.map(row => {
        const value = Number(row.getCell(metric));
        return Number.isFinite(value) ? value : null;
      }),
    };
  };
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: metrics.map(metric => getColumnRenderName(metric)) },
    xAxis: { type: 'category', data: categories },
    yAxis: [{ type: 'value' }, { type: 'value' }],
    series: metrics.map(makeSeries),
  };
};

class MixedChart extends BasicEChartsChart {
  config = Config;
  private mode: MixedMode;
  constructor(mode: MixedMode) {
    super({
      id: `chart-mix-${mode}`,
      name: 'viz.palette.graph.names.mixedChart',
      icon: 'fsux_tubiao_shuangzhoutu',
      requirements: [{ group: 1, aggregate: [2, 999] }],
    });
    this.mode = mode;
  }
  protected getChartOption(dataset: ChartDataSetDTO, config: ChartConfig) {
    return buildMixedOption(dataset, config, this.mode);
  }
}
export const createMixedChart = (mode: MixedMode) => new MixedChart(mode);
export default MixedChart;
