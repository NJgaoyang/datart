import { compactMobileLayout, getMobileGridSpan } from '../mobileLayout';

describe('getMobileGridSpan', () => {
  it('allocates enough pixels for five complete table rows', () => {
    const requiredHeight = 32 + 54 + 5 * 54 + 8 + 54;
    const span = getMobileGridSpan(requiredHeight, 24, 2, 6, 2);
    const allocatedHeight = span * 24 + (span - 1) * 2;

    expect(allocatedHeight).toBeGreaterThanOrEqual(requiredHeight + 2);
  });

  it('keeps the minimum card height for a short result', () => {
    expect(getMobileGridSpan(80, 24, 2, 6, 2)).toBe(6);
  });
});

describe('compactMobileLayout', () => {
  it('shrinks a measured card and moves later rows up by the saved space', () => {
    const result = compactMobileLayout(
      [
        { id: 'table', rect: { x: 0, y: 0, width: 24, height: 16 } },
        { id: 'next', rect: { x: 0, y: 18, width: 24, height: 8 } },
      ],
      { table: 8 },
    );

    expect(result[0].rect.height).toBe(8);
    expect(result[1].rect.y).toBe(10);
  });

  it('grows a measured card and moves later rows down to avoid clipping it', () => {
    const result = compactMobileLayout(
      [
        { id: 'table', rect: { x: 0, y: 0, width: 24, height: 8 } },
        { id: 'next', rect: { x: 0, y: 10, width: 24, height: 8 } },
      ],
      { table: 16 },
    );

    expect(result[0].rect.height).toBe(16);
    expect(result[1].rect.y).toBe(18);
  });
});
