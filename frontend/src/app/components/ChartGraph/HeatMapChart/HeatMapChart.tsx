import { ChartConfig } from 'app/types/ChartConfig';
import ChartDataSetDTO from 'app/types/ChartDataSet';
import { getStyles } from 'app/utils/chartHelper';
import BasicEChartsChart, { getChartDataParts } from '../BasicEChartsChart';
import { buildGeoHeatmapData } from '../chartBuilders';
import Config from './config';

export const buildHeatMapOption = (
  dataset: ChartDataSetDTO,
  config: ChartConfig,
) => {
  const { dataSet, groups, metrics } = getChartDataParts(dataset, config);
  const data = buildGeoHeatmapData(
    dataSet.map(row => ({
      groups: [],
      values: groups
        .slice(0, 2)
        .map(group => Number(row.getCell(group)))
        .concat(Number(row.getCell(metrics[0]))),
    })),
  );
  const [radius] = getStyles(config.styles || [], ['chart'], ['radius']);
  const [blur, startColor, endColor] = getStyles(
    config.styles || [],
    ['chart'],
    ['blur', 'startColor', 'endColor'],
  );
  return {
    geo: { map: 'china', roam: true },
    visualMap: {
      min: 0,
      max: Math.max(1, ...data.map(item => item[2])),
      calculable: true,
      inRange: {
        color: [startColor || '#eef5ff', endColor || '#2f6fed'],
      },
    },
    series: [
      {
        type: 'heatmap',
        coordinateSystem: 'geo',
        data,
        pointSize: radius || 20,
        blurSize: Math.max(1, (radius || 20) * Number(blur || 0.85)),
      },
    ],
  };
};
class HeatMapChart extends BasicEChartsChart {
  config = Config;
  constructor() {
    super({
      id: 'geo-heatmap-chart',
      name: 'viz.palette.graph.names.heatMapChart',
      icon: 'graph',
      requirements: [{ group: 2, aggregate: 1 }],
    });
  }
  protected getChartOption(dataset: ChartDataSetDTO, config: ChartConfig) {
    return buildHeatMapOption(dataset, config);
  }
}
export default HeatMapChart;
