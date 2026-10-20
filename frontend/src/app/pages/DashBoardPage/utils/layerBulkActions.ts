/** The layer panel operates on stable widget IDs, not display names. */
export const getLayerBulkActions = (
  selectedIds: string[],
  widgetMap: Record<string, { config: { lock?: boolean; mVisible?: boolean } }>,
): { ids: string[]; nextLock: boolean; nextMobileVisible: boolean } => {
  const ids = selectedIds.filter(id => Boolean(widgetMap[id]));
  return {
    ids,
    // Mixed locks => lock all; all locked => unlock all.
    nextLock: ids.some(id => !widgetMap[id].config.lock),
    // Mixed visibility => hide all; all hidden => show all.
    nextMobileVisible: !ids.some(id => widgetMap[id].config.mVisible !== false),
  };
};
