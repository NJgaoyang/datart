import { color, group, metric, simpleChartConfig } from '../chartConfig';
export default simpleChartConfig(
  [
    group('category', 1),
    group('series', [0, 1]),
    color('stack', [0, 1]),
    metric(),
  ],
  '分组堆叠柱状图',
  [{ label: 'chart.stack', key: 'stack', default: true, comType: 'checkbox' }],
);
