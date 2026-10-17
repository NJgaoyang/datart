import { getDesktopGridLayout, hasGridGeometryChanged } from '../gridLayout';

describe('native grid geometry', () => {
  const original = [
    { i: 'one', x: 1, y: 2, w: 8, h: 5 },
    { i: 'two', x: 9, y: 2, w: 8, h: 5 },
  ];

  it('ignores order and drag-only metadata', () => {
    expect(hasGridGeometryChanged(original, [
      { ...original[1], moved: true },
      { ...original[0], static: true },
    ])).toBe(false);
  });

  it('detects position or size changes, including collision displacement', () => {
    expect(hasGridGeometryChanged(original, [
      original[0],
      { ...original[1], y: 7 },
    ])).toBe(true);
    expect(hasGridGeometryChanged(original, [
      { ...original[0], w: 12 },
      original[1],
    ])).toBe(true);
  });

  it('detects item addition or deletion', () => {
    expect(hasGridGeometryChanged(original, [original[0]])).toBe(true);
    expect(hasGridGeometryChanged(original, [
      ...original,
      { i: 'three', x: 0, y: 10, w: 1, h: 1 },
    ])).toBe(true);
  });
});

describe('desktop insertion snapshots', () => {
  it('reads persisted desktop geometry independently of mobile positions', () => {
    const widgets = [
      {
        id: 'a',
        config: {
          pRect: { x: 50, y: 10, width: 22, height: 9 },
          mRect: { x: 0, y: 1, width: 8, height: 4 },
        },
      },
    ] as any;
    expect(getDesktopGridLayout(widgets)).toEqual([
      { i: 'a', x: 50, y: 10, w: 22, h: 9 },
    ]);
  });
});
