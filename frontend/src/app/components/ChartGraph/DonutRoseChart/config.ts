import PieConfig from '../BasicPieChart/config';
const config = {
  ...PieConfig,
  styles: [
    ...(PieConfig.styles || []),
    {
      label: 'pie.donut',
      key: 'donut',
      comType: 'group',
      rows: [
        {
          label: 'pie.innerRadius',
          key: 'innerRadius',
          default: 35,
          comType: 'inputNumber',
        },
      ],
    },
  ],
  i18ns: [
    ...(PieConfig.i18ns || []),
    {
      lang: 'zh-CN',
      translation: { pie: { donut: '环形玫瑰', innerRadius: '内半径' } },
    },
    {
      lang: 'en-US',
      translation: {
        pie: { donut: 'Donut rose', innerRadius: 'Inner radius' },
      },
    },
  ],
};
export default config;
