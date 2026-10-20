import type { LayerNode } from './LayerTreeItem';

/** Preserve parents of matching descendants without rewriting Widget ids. */
export const filterLayerNodes = (
  nodes: LayerNode[],
  query: string,
  selectedType?: string,
): LayerNode[] => {
  const term = query.trim().toLocaleLowerCase();
  if (!term && !selectedType) return nodes;
  const walk = (items: LayerNode[]): LayerNode[] => items.flatMap(node => {
    const children = walk(node.children || []);
    const matchesText = !term || String(node.title || '').toLocaleLowerCase().includes(term);
    const matchesType = !selectedType || node.originalType === selectedType;
    if (matchesText && matchesType) return [node];
    return children.length ? [{ ...node, children }] : [];
  });
  return walk(nodes);
};

export const getLayerNodeTypes = (nodes: LayerNode[]): string[] => {
  const types = new Set<string>();
  const walk = (items: LayerNode[]) => {
    items.forEach(node => {
      if (node.originalType) types.add(node.originalType);
      walk(node.children || []);
    });
  };
  walk(nodes);
  return Array.from(types).sort();
};
