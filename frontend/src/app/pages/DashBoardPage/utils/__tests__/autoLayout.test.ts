import {
  AUTO_GRID_COLS,
  AUTO_LAYOUT_VERSION,
  LEGACY_MOBILE_LAYOUT_VERSION,
  MOBILE_GRID_COLS,
  MOBILE_LAYOUT_VERSION,
  PC_ROW_LAYOUT_VERSION,
  LEGACY_AUTO_GRID_COLS,
} from '../../constants';
import {
  isMobileWidgetVisible,
  migrateAutoWidgetLayout,
  migrateAutoWidgetsLayout,
  scaleAutoRect,
} from '../autoLayout';

describe('auto layout migration', () => {
  it('scales legacy desktop coordinates to the 72-column grid', () => {
    expect(
      scaleAutoRect(
        { x: 2, y: 3, width: 4, height: 5 },
        LEGACY_AUTO_GRID_COLS,
        AUTO_GRID_COLS,
      ),
    ).toEqual({ x: 12, y: 3, width: 24, height: 5 });
  });

  it('creates a mobile rect without changing widget identity or query config', () => {
    const widget = {
      id: 'widget-1',
      config: {
        pRect: { x: 2, y: 3, width: 4, height: 5 },
        rect: { x: 10, y: 10, width: 100, height: 100 },
        customConfig: { datas: [{ id: 'query-field' }] },
      },
    } as any;

    const result = migrateAutoWidgetLayout(widget);
    expect(result.id).toBe(widget.id);
    expect(result.config.customConfig).toBe(widget.config.customConfig);
    expect(result.config.pRect).toEqual({ x: 12, y: 3, width: 24, height: 5 });
    expect(result.config.mRect).toEqual({ x: 4, y: 3, width: 8, height: 5 });
    expect(result.config.mRect!.x + result.config.mRect!.width).toBeLessThanOrEqual(
      MOBILE_GRID_COLS,
    );
  });

  it('scales existing 6-column mobile layouts to 24 columns', () => {
    const widget = {
      id: 'widget-1',
      config: {
        pRect: { x: 12, y: 3, width: 24, height: 5 },
        mRect: { x: 1, y: 3, width: 2, height: 5 },
      },
    } as any;

    const [result] = migrateAutoWidgetsLayout(
      [widget],
      AUTO_LAYOUT_VERSION,
      LEGACY_MOBILE_LAYOUT_VERSION,
      PC_ROW_LAYOUT_VERSION,
    );

    expect(result.config.mRect).toEqual({ x: 4, y: 3, width: 8, height: 5 });
    expect(result.config.pRect).toEqual(widget.config.pRect);
    expect(MOBILE_LAYOUT_VERSION).toBe(2);
  });

  it('keeps the visual desktop height while upgrading the row precision', () => {
    const [result] = migrateAutoWidgetsLayout(
      [
        {
          id: 'widget-1',
          config: {
            pRect: { x: 12, y: 3, width: 24, height: 18 },
            mRect: { x: 4, y: 3, width: 8, height: 5 },
          },
        } as any,
      ],
      AUTO_LAYOUT_VERSION,
      MOBILE_LAYOUT_VERSION,
      1,
    );

    expect(result.config.pRect).toEqual({ x: 12, y: 12, width: 24, height: 72 });
  });

  it('keeps legacy widgets visible and respects explicit mobile visibility', () => {
    expect(isMobileWidgetVisible({ config: {} } as any)).toBe(true);
    expect(isMobileWidgetVisible({ config: { mVisible: true } } as any)).toBe(
      true,
    );
    expect(isMobileWidgetVisible({ config: { mVisible: false } } as any)).toBe(
      false,
    );
  });
});
