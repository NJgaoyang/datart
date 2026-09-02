import { ChartConfig } from 'app/types/ChartConfig';
import ChartDataSetDTO from 'app/types/ChartDataSet';
import { getStyles } from 'app/utils/chartHelper';
import BasicEChartsChart, { getChartDataParts } from '../BasicEChartsChart';
import { buildHierarchy } from '../chartBuilders';
import Config from './config';

export const buildTreemapOption = (
  dataset: ChartDataSetDTO,
  config: ChartConfig,
) => {
  const { dataSet, groups, metrics } = getChartDataParts(dataset, config);
  const tree = buildHierarchy(
    dataSet.map(row => ({
      groups: groups.map(group => row.getCell(group) as string),
      values: [Number(row.getCell(metrics[0]))],
    })),
  );
  const [round] = getStyles(config.styles || [], ['chart'], ['round']);
  return {
    tooltip: { trigger: 'item' },
    series: [
      {
        type: 'treemap',
        roam: true,
        nodeClick: false,
        data: tree,
        label: { show: true },
        itemStyle: { borderRadius: Math.max(0, Number(round ?? 4)) },
      },
    ],
  };
};

class TreemapChart extends BasicEChartsChart {
  config = Config;
  constructor() {
    super({
      id: 'treemap-chart',
      name: 'viz.palette.graph.names.treemapChart',
      icon: 'treemap',
      requirements: [{ group: [1, 999], aggregate: 1 }],
    });
  }
  protected getChartOption(dataset: ChartDataSetDTO, config: ChartConfig) {
    return buildTreemapOption(dataset, config);
  }
}
export default TreemapChart;
