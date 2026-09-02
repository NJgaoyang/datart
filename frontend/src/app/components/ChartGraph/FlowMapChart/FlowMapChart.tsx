import { ChartConfig } from 'app/types/ChartConfig';
import ChartDataSetDTO from 'app/types/ChartDataSet';
import { getStyles } from 'app/utils/chartHelper';
import BasicEChartsChart, { getChartDataParts } from '../BasicEChartsChart';
import { buildFlowData } from '../chartBuilders';
import Config from './config';
import china from '../BasicOutlineMapChart/geo-china.map.json';
import { registerMap } from 'echarts';

export const buildFlowMapOption = (
  dataset: ChartDataSetDTO,
  config: ChartConfig,
) => {
  registerMap('china', china as any);
  const { dataSet, groups, metrics } = getChartDataParts(dataset, config);
  const flow = buildFlowData(
    dataSet.map(row => ({
      groups: groups.map(group => row.getCell(group) as string),
      values: metrics.map(metric => Number(row.getCell(metric))),
    })),
  );
  const [animation] = getStyles(config.styles || [], ['chart'], ['animation']);
  const showEffect = animation !== false;
  return {
    geo: { map: 'china', roam: true },
    tooltip: { trigger: 'item' },
    series: [
      {
        type: 'lines',
        coordinateSystem: 'geo',
        effect: { show: showEffect, symbol: 'arrow', trailLength: 0.2 },
        lineStyle: { curveness: 0.2 },
        data: flow.map(item => ({
          coords: [item.start, item.end],
          value: item.value,
          name: item.name,
          lineStyle: { width: Math.max(1, Math.min(10, Math.abs(item.value))) },
        })),
      },
      {
        type: 'effectScatter',
        coordinateSystem: 'geo',
        data: flow.flatMap(item => [
          {
            name: item.startName || item.name,
            value: [...item.start, item.value],
          },
          { name: item.endName || item.name, value: [...item.end, item.value] },
        ]),
      },
    ],
  };
};
class FlowMapChart extends BasicEChartsChart {
  config = Config;
  constructor() {
    super({
      id: 'flow-map-chart',
      name: 'viz.palette.graph.names.flowMapChart',
      icon: 'ditu',
      requirements: [{ aggregate: [4, 5] }],
    });
  }
  protected getChartOption(dataset: ChartDataSetDTO, config: ChartConfig) {
    return buildFlowMapOption(dataset, config);
  }
}
export default FlowMapChart;
