import { group, metric, simpleChartConfig } from '../chartConfig';
export default simpleChartConfig(
  [group('dimensions', [1, 999]), metric()],
  '圆形打包图',
);
