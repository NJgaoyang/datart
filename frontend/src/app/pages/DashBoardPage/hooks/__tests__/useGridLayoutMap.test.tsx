import { renderHook } from '@testing-library/react';
import type { Widget } from '../../types/widgetTypes';
import useGridLayoutMap from '../useGridLayoutMap';

const createWidget = (id: string, lock = false) =>
  ({
    id,
    config: {
      originalType: 'ownedChart',
      lock,
      pRect: { x: 12, y: 4, width: 24, height: 16 },
      mRect: { x: 2, y: 3, width: 8, height: 5 },
    },
  } as Widget);

describe('new automatic dashboard grid mapping', () => {
  it('preserves the native desktop and mobile coordinates without migration', () => {
    const widget = createWidget('chart-1');
    const { result } = renderHook(() => useGridLayoutMap([widget]));

    expect(result.current.lg).toEqual([
      expect.objectContaining({
        i: 'chart-1',
        x: 12,
        y: 4,
        w: 24,
        h: 16,
        static: false,
      }),
    ]);
    expect(result.current.sm).toEqual([
      expect.objectContaining({
        i: 'chart-1',
        x: 2,
        y: 3,
        w: 8,
        h: 5,
      }),
    ]);
    expect(widget.config.pRect).toEqual({
      x: 12, y: 4, width: 24, height: 16,
    });
  });

  it('propagates widget locking independently to both device layouts', () => {
    const { result } = renderHook(() => useGridLayoutMap([createWidget('locked-1', true)]));
    expect(result.current.lg?.[0].static).toBe(true);
    expect(result.current.sm?.[0].static).toBe(true);
  });

  it('lets mobile date ranges resize to two rows without altering saved geometry', () => {
    const rangeTime = {
      id: 'date-range',
      config: {
        originalType: 'rangeTime',
        lock: false,
        pRect: { x: 0, y: 0, width: 30, height: 4 },
        mRect: { x: 0, y: 0, width: 24, height: 3 },
      },
    } as Widget;
    const { result } = renderHook(() => useGridLayoutMap([rangeTime]));
    expect(result.current.sm?.[0].minW).toBe(1);
    expect(result.current.sm?.[0].minH).toBe(2);
    expect(result.current.sm?.[0].maxH).toBe(16);
    expect(result.current.sm?.[0].h).toBe(3);
    expect(rangeTime.config.mRect).toEqual({ x: 0, y: 0, width: 24, height: 3 });
    expect(result.current.lg?.[0].minH).toBe(3);
  });

  it('allows controls to shrink horizontally on desktop and mobile', () => {
    const controller = {
      id: 'filter-1',
      config: {
        originalType: 'dropdownList',
        lock: false,
        pRect: { x: 0, y: 0, width: 18, height: 2 },
        mRect: { x: 0, y: 0, width: 8, height: 1 },
      },
    } as Widget;
    const { result } = renderHook(() => useGridLayoutMap([controller]));
    expect(result.current.lg?.[0].minW).toBe(1);
    expect(result.current.sm?.[0].minW).toBe(1);
    expect(result.current.sm?.[0].minH).toBe(1);
    expect(result.current.lg?.[0].maxW).toBe(72);
    expect(result.current.sm?.[0].maxW).toBe(24);
  });

});
