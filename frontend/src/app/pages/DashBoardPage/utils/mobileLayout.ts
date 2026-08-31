import { RectConfig } from '../pages/Board/slice/types';

type MobileLayoutItem = {
  id: string;
  rect: RectConfig;
};

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
