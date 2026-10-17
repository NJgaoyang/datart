import type { CSSProperties } from 'react';

export type GridCompactType = 'vertical' | 'horizontal' | 'none';

export const resolveGridCompactType = (
  value: GridCompactType,
): 'vertical' | 'horizontal' | null =>
  value === 'none' ? null : value;

/**
 * Pixel-accurate visual guides for RGL v2. The background is drawn by CSS
 * and never captures pointer events or mounts extra React grid children.
 */
export const getGridGuideStyle = (
  width: number,
  config: {
    cols: number;
    rowHeight: number;
    margin: readonly [number, number];
    containerPadding: readonly [number, number];
  },
): CSSProperties => {
  const { cols, rowHeight, margin, containerPadding } = config;
  const stepX = (width - 2 * containerPadding[0] + margin[0]) / cols;
  const stepY = rowHeight + margin[1];
  if (stepX <= 0 || stepY <= 0 || !Number.isFinite(stepX)) return {};
  return {
    backgroundImage:
      'linear-gradient(to right, rgba(22, 119, 255, 0.16) 1px, transparent 1px), ' +
      'linear-gradient(to bottom, rgba(22, 119, 255, 0.16) 1px, transparent 1px)',
    backgroundSize: `${stepX}px ${stepY}px`,
    backgroundPosition: `${containerPadding[0]}px ${containerPadding[1]}px`,
    backgroundRepeat: 'repeat',
  };
};
