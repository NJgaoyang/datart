import { group, metric, simpleChartConfig } from '../chartConfig';
export default simpleChartConfig(
  [group('dimensions', [1, 999]), metric()],
  '矩形树图',
  [{ label: 'chart.round', key: 'round', default: 4, comType: 'inputNumber' }],
);
