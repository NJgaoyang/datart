import { ChartConfig } from 'app/types/ChartConfig';
import ChartDataSetDTO from 'app/types/ChartDataSet';
import { getStyles } from 'app/utils/chartHelper';
import BasicEChartsChart, { getChartDataParts } from '../BasicEChartsChart';
import { buildSankeyData } from '../chartBuilders';
import Config from './config';

export const buildSankeyOption = (
  dataset: ChartDataSetDTO,
  config: ChartConfig,
) => {
  const { dataSet, groups, metrics } = getChartDataParts(dataset, config);
  const data = buildSankeyData(
    dataSet.map(row => ({
      source: row.getCell(groups[0]),
      target: row.getCell(groups[1]),
      value: row.getCell(metrics[0]),
    })),
  );
  const [orient] = getStyles(config.styles || [], ['chart'], ['orient']);
  return {
    tooltip: { trigger: 'item' },
    series: [
      {
        type: 'sankey',
        orient: orient || 'horizontal',
        nodeAlign: 'justify',
        data: data.nodes,
        links: data.links,
        emphasis: { focus: 'adjacency' },
        lineStyle: { color: 'gradient', curveness: 0.5 },
      },
    ],
  };
};
class SankeyChart extends BasicEChartsChart {
  config = Config;
  constructor() {
    super({
      id: 'sankey-chart',
      name: 'viz.palette.graph.names.sankeyChart',
      icon: 'sankey',
      requirements: [{ group: 2, aggregate: 1 }],
    });
  }
  protected getChartOption(dataset: ChartDataSetDTO, config: ChartConfig) {
    return buildSankeyOption(dataset, config);
  }
}
export default SankeyChart;
