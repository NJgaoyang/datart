import ScatterConfig from '../ScatterOutlineMapChart/config';
const config = {
  ...ScatterConfig,
  styles: [
    ...(ScatterConfig.styles || []),
    {
      label: 'symbol.title',
      key: 'symbol',
      comType: 'group',
      rows: [
        {
          label: 'symbol.type',
          key: 'type',
          default: 'circle',
          comType: 'select',
          options: { items: ['circle', 'rect', 'diamond', 'triangle'] },
        },
        {
          label: 'symbol.opacity',
          key: 'opacity',
          default: 0.8,
          comType: 'slider',
        },
      ],
    },
  ],
  i18ns: [
    ...(ScatterConfig.i18ns || []),
    {
      lang: 'zh-CN',
      translation: {
        symbol: { title: '符号', type: '类型', opacity: '透明度' },
      },
    },
    {
      lang: 'en-US',
      translation: {
        symbol: { title: 'Symbol', type: 'Type', opacity: 'Opacity' },
      },
    },
  ],
};
export default config;
