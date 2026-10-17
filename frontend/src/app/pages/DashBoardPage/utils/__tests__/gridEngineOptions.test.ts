import { getCompactor } from 'react-grid-layout/core';
import { getGridGuideStyle, resolveGridCompactType } from '../gridEngineOptions';

describe('configurable automatic-dashboard grid engine', () => {
  it('maps user settings to the native v2 compactors', () => {
    expect(resolveGridCompactType('none')).toBe(null);
    expect(getCompactor(resolveGridCompactType('horizontal'), false).allowOverlap).toBe(false);
    expect(getCompactor(resolveGridCompactType('vertical'), true).allowOverlap).toBe(true);
    expect(getCompactor(resolveGridCompactType('none'), false).allowOverlap).toBe(false);
  });

  it('draws CSS guides at the exact measured RGL column and row stride', () => {
    const guides = getGridGuideStyle(1440, {
      cols: 72, rowHeight: 8,
      margin: [4, 4], containerPadding: [8, 8],
    });
    expect(guides.backgroundPosition).toBe('8px 8px');
    expect(guides.backgroundSize).toBe(`${(1440 - 16 + 4) / 72}px 12px`);
    expect(guides.backgroundImage).toContain('linear-gradient');
  });

  it('does not render unusable visual guides for a zero-width grid', () => {
    expect(getGridGuideStyle(0, {
      cols: 72, rowHeight: 8, margin: [0, 0], containerPadding: [0, 0],
    })).toEqual({});
  });
});
