import { AUTO_GRID_COLS, MOBILE_GRID_COLS } from '../../constants';
import { isMobileWidgetVisible, normalizeAutoRectForCols, scaleAutoRect } from '../autoLayout';

describe('new automatic dashboard layouts', () => {
  it('normalizes a 72-column desktop rectangle to 24 mobile columns', () => {
    expect(
      normalizeAutoRectForCols(
        { x: 12, y: 3, width: 24, height: 12 },
        MOBILE_GRID_COLS,
      ),
    ).toEqual({ x: 4, y: 3, width: 8, height: 12 });
    expect(AUTO_GRID_COLS).toBe(72);
  });

  it('rounds responsive coordinates without mutating the source', () => {
    const rect = { x: 5, y: 2, width: 7, height: 3 };
    expect(scaleAutoRect(rect, 72, 24)).toEqual({
      x: 2, y: 2, width: 2, height: 3,
    });
    expect(rect).toEqual({ x: 5, y: 2, width: 7, height: 3 });
  });

  it('respects explicit mobile visibility', () => {
    expect(isMobileWidgetVisible({ config: {} } as any)).toBe(true);
    expect(isMobileWidgetVisible({ config: { mVisible: false } } as any)).toBe(false);
  });
});
