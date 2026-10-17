import { isTypingTarget, nudgeGridLayout } from '../gridKeyboard';

describe('dashboard accessible keyboard movement', () => {
  const layout = [
    { i: 'first', x: 0, y: 0, w: 4, h: 3 },
    { i: 'second', x: 4, y: 0, w: 4, h: 3 },
    { i: 'locked', x: 15, y: 1, w: 4, h: 3, static: true },
  ];
  it('moves selected widgets one grid unit without moving unrelated widgets', () => {
    const result = nudgeGridLayout(layout, new Set(['first']), 0, 1, 24);
    expect(result[0].y).toBe(1);
    expect(result[1]).toBe(layout[1]);
    expect(layout[0].y).toBe(0);
  });
  it('refuses collisions and out-of-bounds changes', () => {
    expect(nudgeGridLayout(layout, new Set(['first']), 1, 0, 24)).toBe(layout);
    expect(nudgeGridLayout(layout, new Set(['first']), -1, 0, 24)).toBe(layout);
    expect(nudgeGridLayout(layout, new Set(['locked']), 1, 0, 24)).toBe(layout);
  });
  it('allows configured overlap but still respects bounds', () => {
    expect(nudgeGridLayout(layout, new Set(['first']), 1, 0, 24, true)[0].x).toBe(1);
  });
  it('moves a multi-selection together and rejects missing widgets', () => {
    const result = nudgeGridLayout(layout, new Set(['first', 'second']), 1, 0, 24);
    expect(result.map(item => item.x)).toEqual([1, 5, 15]);
    expect(nudgeGridLayout(layout, new Set(['absent']), 1, 0, 24)).toBe(layout);
  });
  it('leaves arrows and shortcuts available inside editing controls', () => {
    const textarea = document.createElement('textarea');
    expect(isTypingTarget(textarea)).toBe(true);
    const input = document.createElement('input');
    expect(isTypingTarget(input)).toBe(true);
    const div = document.createElement('div');
    expect(isTypingTarget(div)).toBe(false);
  });
});
