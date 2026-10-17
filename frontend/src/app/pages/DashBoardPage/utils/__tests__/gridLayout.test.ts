import { getDesktopGridLayout, getMobileGridLayout, hasGridGeometryChanged } from '../gridLayout';

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

  it('provides a responsive default for new widgets with no mobile rect', () => {
    const widgets = [
      { id: 'new', config: { pRect: { x: 18, y: 3, width: 36, height: 8 } } },
    ] as any;
    expect(getMobileGridLayout(widgets)).toEqual([
      { i: 'new', x: 6, y: 3, w: 12, h: 8 },
    ]);
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
    expect(getMobileGridLayout(widgets)).toEqual([
      { i: 'a', x: 0, y: 1, w: 8, h: 4 },
    ]);
  });
  it('excludes widgets explicitly hidden on mobile from placement', () => {
    const widgets = [
      {
        id: 'hidden',
        config: {
          pRect: { x: 0, y: 0, width: 36, height: 8 },
          mRect: { x: 0, y: 500, width: 24, height: 20 },
          mVisible: false,
        },
      },
      {
        id: 'visible',
        config: {
          pRect: { x: 0, y: 0, width: 36, height: 8 },
          mRect: { x: 0, y: 12, width: 24, height: 5 },
        },
      },
    ] as any;
    expect(getMobileGridLayout(widgets).map(item => item.i)).toEqual(['visible']);
  });

});
