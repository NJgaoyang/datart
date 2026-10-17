import { getCompactor } from 'react-grid-layout/core';
import { getGridGuideStyle, resolveGridCompactType } from '../gridEngineOptions';

describe('configurable automatic-dashboard grid engine', () => {
  it('maps user settings to the native v2 compactors', () => {
    expect(resolveGridCompactType('none')).toBe(null);
    expect(getCompactor(resolveGridCompactType('horizontal'), false).allowOverlap).toBe(false);
    expect(getCompactor(resolveGridCompactType('vertical'), true).allowOverlap).toBe(true);
    expect(getCompactor(resolveGridCompactType('none'), false).allowOverlap).toBe(false);
  });

  it('compacts around locked widgets while preserving unrelated dimensions', () => {
    const layout = [
      { i: 'locked', x: 0, y: 0, w: 12, h: 4, static: true },
      { i: 'moving', x: 0, y: 10, w: 12, h: 3 },
    ];
    const compact = getCompactor('vertical', false).compact(layout, 72);
    expect(compact.find(item => item.i === 'locked')?.y).toBe(0);
    expect(compact.find(item => item.i === 'moving')?.y).toBe(4);
    expect(layout[1].y).toBe(10);
  });

  it('preserves placement when users disable compaction', () => {
    const layout = [{ i: 'fixed', x: 24, y: 12, w: 18, h: 8 }];
    const result = getCompactor(null, false).compact(layout, 72);
    expect(result[0]).toMatchObject(layout[0]);
    expect(result).not.toBe(layout);
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
