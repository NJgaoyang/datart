import { describe, expect, it, vi } from 'vitest';
import { stabilizeVirtualGridWidth } from '../VirtualTable';

describe('stabilizeVirtualGridWidth', () => {
  it('measures all columns before restoring the current horizontal position', () => {
    const grid = {
      state: { scrollLeft: 240 },
      resetAfterIndices: vi.fn(),
      scrollToItem: vi.fn(),
      scrollTo: vi.fn(),
    };

    stabilizeVirtualGridWidth(grid, 12);

    expect(grid.resetAfterIndices).toHaveBeenCalledWith({
      columnIndex: 0,
      shouldForceUpdate: false,
    });
    expect(grid.scrollToItem).toHaveBeenCalledWith({ columnIndex: 11, align: 'start' });
    expect(grid.scrollTo).toHaveBeenCalledWith({ scrollLeft: 240 });
  });
});
