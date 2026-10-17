/** Locate only native RGL grid cells inside the active dashboard editor. */
export const locateAutoWidget = (widgetId: string, root: ParentNode | null): boolean => {
  if (!root || !widgetId) return false;
  const element = Array.from(root.querySelectorAll<HTMLElement>('[data-dashboard-widget-id]'))
    .find(item => item.getAttribute('data-dashboard-widget-id') === widgetId);
  if (!element) return false;
  element.scrollIntoView?.({ behavior: 'smooth', block: 'center', inline: 'center' });
  element.focus({ preventScroll: true });
  return true;
};
