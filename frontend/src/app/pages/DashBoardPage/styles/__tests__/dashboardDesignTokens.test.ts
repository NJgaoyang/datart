import { DASHBOARD_DESIGN_TOKENS as T, getDashboardDesignPalette } from '../dashboardDesignTokens';
import { MOBILE_BOARD_THEME } from '../../pages/Board/mobileTheme';

describe('dashboard semantic visual tokens', () => {
  it('preserves existing default spacing, colors, and radii', () => {
    expect(MOBILE_BOARD_THEME.gridGap).toBe(4);
    expect(MOBILE_BOARD_THEME.pagePadding).toBe(8);
    expect(MOBILE_BOARD_THEME.cardRadius).toBe(12);
    expect(MOBILE_BOARD_THEME.cardBackground).toBe('#fff');
    expect(MOBILE_BOARD_THEME.titleColor).toBe('#1f2329');
    expect(MOBILE_BOARD_THEME.navTextColor).toBe('#1a1a1a');
    expect(MOBILE_BOARD_THEME.navDividerColor).toBe('rgba(0, 0, 0, 0.08)');
  });
  it('defines distinct theme palettes without altering existing light mode', () => {
    for (const mode of ['light', 'dark'] as const) {
      const c = getDashboardDesignPalette(mode);
      for (const val of Object.values(c)) expect(val).not.toBe('');
      expect(c.card).not.toBe(c.text);
      expect(c.card).not.toBe(c.page);
    }
    expect(getDashboardDesignPalette()).toBe(T.color.light);
  });
});