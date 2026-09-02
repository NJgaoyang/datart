import { group, simpleChartConfig } from '../chartConfig';
export default simpleChartConfig(
  [group('image', 1), group('label', [0, 1])],
  '图片组',
  [
    {
      label: 'chart.columns',
      key: 'columns',
      default: 4,
      comType: 'inputNumber',
      options: { min: 1, max: 12 },
    },
    {
      label: 'chart.fit',
      key: 'fit',
      default: 'cover',
      comType: 'select',
      options: { items: ['cover', 'contain'] },
    },
    {
      label: 'chart.radius',
      key: 'radius',
      default: 4,
      comType: 'inputNumber',
      options: { min: 0 },
    },
  ],
);
