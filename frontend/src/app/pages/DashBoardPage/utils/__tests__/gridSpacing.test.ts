import { getResponsiveGridSpacing } from '../gridSpacing';

describe('automatic grid spacing by container width', () => {
  const base = {
    cols: 72,
    margin: [8, 8] as [number, number],
    containerPadding: [16, 16] as [number, number],
  };

  it('preserves user spacing on wide displays', () => {
    expect(getResponsiveGridSpacing({ ...base, width: 1600 })).toEqual({
      margin: [8, 8],
      containerPadding: [16, 16],
    });
  });

  it('reduces widget gaps and canvas padding on narrow displays', () => {
    expect(getResponsiveGridSpacing({ ...base, width: 720 })).toEqual({
      margin: [4, 4],
      containerPadding: [8, 8],
    });
  });

  it('keeps dedicated mobile padding and margins', () => {
    expect(getResponsiveGridSpacing({
      width: 320,
      cols: 24,
      margin: [2, 2],
      containerPadding: [4, 4],
    })).toEqual({
      margin: [2, 2],
      containerPadding: [4, 4],
    });
  });

  it('supports zero spacing and caps gaps on very narrow grids', () => {
    expect(getResponsiveGridSpacing({
      width: 200, cols: 24, margin: [0, 0], containerPadding: [0, 0],
    }).margin).toEqual([0, 0]);
    expect(getResponsiveGridSpacing({
      width: 100, cols: 72, margin: [20, 8], containerPadding: [16, 16],
    }).margin[0]).toBe(0);
  });
});
