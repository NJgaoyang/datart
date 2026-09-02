import { group, metric, simpleChartConfig } from '../chartConfig';
export default simpleChartConfig(
  [group('source', 1), group('target', 1), metric('value', 1)],
  '桑基图',
  [
    {
      label: 'chart.orient',
      key: 'orient',
      default: 'horizontal',
      comType: 'select',
      options: { items: ['horizontal', 'vertical'] },
    },
  ],
);
