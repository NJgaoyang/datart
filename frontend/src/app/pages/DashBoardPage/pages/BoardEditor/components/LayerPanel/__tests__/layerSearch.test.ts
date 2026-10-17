import type { LayerNode } from '../LayerTreeItem';
import { filterLayerNodes, getLayerNodeTypes } from '../layerSearch';

const item = (key: string, title: string, originalType: string, children: LayerNode[] = []): LayerNode =>
  ({ key, title, originalType, children } as LayerNode);

describe('dashboard layer search', () => {
  const widgets = [
    item('group', '销售区域', 'group', [
      item('chart-a', '上海销售额', 'ownedChart'),
      item('filter-b', '月份选择', 'dropdownList'),
    ]),
    item('chart-c', '利润总计', 'ownedChart'),
  ];

  it('keeps parent groups when searching for matching children', () => {
    const result = filterLayerNodes(widgets, '月份');
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('group');
    expect(result[0].children.map(item => item.key)).toEqual(['filter-b']);
  });

  it('filters by type without changing source data or widget identifiers', () => {
    const result = filterLayerNodes(widgets, '', 'ownedChart');
    expect(result.map(item => item.key)).toEqual(['group', 'chart-c']);
    expect(result[0].children.map(item => item.key)).toEqual(['chart-a']);
    expect(widgets[0].children).toHaveLength(2);
  });

  it('collects all nested component types for the type selector', () => {
    expect(getLayerNodeTypes(widgets)).toEqual(['dropdownList', 'group', 'ownedChart']);
    expect(filterLayerNodes(widgets, '', undefined)).toBe(widgets);
  });
});
