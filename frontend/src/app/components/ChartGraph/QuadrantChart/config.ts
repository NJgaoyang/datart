import ScatterConfig from '../BasicScatterChart/config';
const config = {
  ...ScatterConfig,
  styles: [
    ...(ScatterConfig.styles || []),
    {
      label: 'quadrant.title',
      key: 'quadrant',
      comType: 'group',
      rows: [
        {
          label: 'quadrant.xSplit',
          key: 'xSplit',
          default: 0,
          comType: 'inputNumber',
        },
        {
          label: 'quadrant.ySplit',
          key: 'ySplit',
          default: 0,
          comType: 'inputNumber',
        },
      ],
    },
  ],
  i18ns: [
    ...(ScatterConfig.i18ns || []),
    {
      lang: 'zh-CN',
      translation: {
        quadrant: { title: '象限设置', xSplit: 'X 分割值', ySplit: 'Y 分割值' },
      },
    },
    {
      lang: 'en-US',
      translation: {
        quadrant: { title: 'Quadrant', xSplit: 'X split', ySplit: 'Y split' },
      },
    },
  ],
};
export default config;
