import { group, metric, simpleChartConfig } from '../chartConfig';
export default simpleChartConfig(
  [
    group('startName', [0, 1]),
    group('endName', [0, 1]),
    metric('coordinates', 4),
    metric('width', [0, 1]),
  ],
  '流向地图',
  [
    {
      label: 'chart.animation',
      key: 'animation',
      default: true,
      comType: 'checkbox',
    },
  ],
);
