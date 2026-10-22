import { renderHook } from '@testing-library/react';
import { vi } from 'vitest';
import { BASE_ROW_HEIGHT, MOBILE_ROW_HEIGHT } from 'app/pages/DashBoardPage/constants';
import { useGridWidgetHeight } from '../useGridWidgetHeight';

const measurement = vi.hoisted(() => ({ width: 1000, height: 600 }));

vi.mock('redux/hooks', () => ({ useAppDispatch: () => vi.fn() }));
vi.mock('../useResizeObserver', () => ({
  default: () => ({ ref: { current: null }, ...measurement }),
}));

describe('dashboard row height', () => {
  it('keeps desktop height stable as the canvas width changes', () => {
    const { result, rerender } = renderHook(() => useGridWidgetHeight(false));
    expect(result.current.widgetRowHeight).toBe(BASE_ROW_HEIGHT);
    measurement.width = 1800;
    rerender();
    expect(result.current.canvasWidth).toBe(1800);
    expect(result.current.widgetRowHeight).toBe(BASE_ROW_HEIGHT);
  });

  it('preserves the independent mobile row height', () => {
    const { result } = renderHook(() => useGridWidgetHeight(true));
    expect(result.current.widgetRowHeight).toBe(MOBILE_ROW_HEIGHT);
  });
});
