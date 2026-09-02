import { group, metric, simpleChartConfig } from '../chartConfig';
export default simpleChartConfig([group(), metric('range', 2)], '区间条形图', [
  {
    label: 'chart.horizontal',
    key: 'horizontal',
    default: true,
    comType: 'checkbox',
  },
]);
