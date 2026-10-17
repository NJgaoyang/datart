import { render, screen } from '@testing-library/react';
import { memo } from 'react';
import { renderHook } from '@testing-library/react';
import useGridLayoutMap from '../../hooks/useGridLayoutMap';
import type { Widget } from '../../types/widgetTypes';

const makeWidget = (id: string): Widget => ({
  id,
  config: {
    index: Number(id.split('-')[1]),
    pRect: { x: 0, y: 0, width: 24, height: 8 },
    mRect: { x: 0, y: 0, width: 8, height: 8 },
    originalType: 'ownedChart',
  },
} as Widget);

describe('dense automatic dashboard baseline', () => {
  it('maps 1000 native widgets without losing ids or mutating source objects', () => {
    const widgets = Array.from({ length: 1000 }, (_, i) => makeWidget(`item-${i}`));
    const before = widgets[0].config.pRect;
    const { result } = renderHook(() => useGridLayoutMap(widgets));
    expect(result.current.lg).toHaveLength(1000);
    expect(result.current.sm).toHaveLength(1000);
    expect(result.current.lg?.[999].i).toBe('item-999');
    expect(widgets[0].config.pRect).toBe(before);
  });
});
