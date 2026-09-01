import { RectConfig } from '../pages/Board/slice/types';

type MobileLayoutItem = {
  id: string;
  rect: RectConfig;
};

const MOBILE_TABLE_READY_CLASS = 'mobile-table-layout-ready';

export const prepareMobileTableLayout = (
  root: HTMLElement,
  tableKey: string,
): boolean => {
  if (
    root.dataset.mobileTableReadyKey === tableKey &&
    root.classList.contains(MOBILE_TABLE_READY_CLASS)
  ) {
    return true;
  }
  delete root.dataset.mobileTableReadyKey;
  root.classList.remove(MOBILE_TABLE_READY_CLASS);
  return false;
};

export const markMobileTableLayoutReady = (
  root: HTMLElement,
  tableKey: string,
) => {
  root.dataset.mobileTableReadyKey = tableKey;
  root.classList.add(MOBILE_TABLE_READY_CLASS);
};

/** Find measurable content from the currently active tab only. */
export const findVisibleMobilePresentation = (
  root: HTMLElement,
): HTMLElement | undefined =>
  [
    ...root.querySelectorAll<HTMLElement>('.mobile-table-presentation'),
  ].find(candidate => {
    if (
      candidate.closest(
        '.ant-tabs-tabpane:not(.ant-tabs-tabpane-active)',
      )
    ) {
      return false;
    }
    const rect = candidate.getBoundingClientRect();
    return (
      candidate.getClientRects().length > 0 &&
      rect.width > 0 &&
      (rect.height > 0 || candidate.scrollHeight > 0)
    );
  });

/** Convert a required pixel height to a grid span without clipping its bottom. */
export const getMobileGridSpan = (
  requiredHeight: number,
  rowHeight: number,
  gap: number,
  minRows: number,
  bottomGuard = 0,
): number =>
  Math.max(
    minRows,
    Math.ceil((requiredHeight + bottomGuard + gap) / (rowHeight + gap)),
  );

/** Apply measured card heights and keep following mobile rows aligned. */
export const compactMobileLayout = (
  items: MobileLayoutItem[],
  compactHeights: Record<string, number>,
): MobileLayoutItem[] => {
  const rows = new Map<number, MobileLayoutItem[]>();
  items.forEach(item => {
    const row = rows.get(item.rect.y) || [];
    row.push(item);
    rows.set(item.rect.y, row);
  });

  let offset = 0;
  const result: MobileLayoutItem[] = [];
  [...rows.entries()]
    .sort(([a], [b]) => a - b)
    .forEach(([y, row]) => {
      const originalHeight = Math.max(...row.map(item => item.rect.height));
      const measuredHeight = Math.max(
        ...row.map(item => compactHeights[item.id] || item.rect.height),
      );
      row.forEach(item => {
        result.push({
          ...item,
          rect: {
            ...item.rect,
            y: Math.max(0, y - offset),
            height: compactHeights[item.id] || item.rect.height,
          },
        });
      });
      offset += originalHeight - measuredHeight;
    });

  return result;
};
