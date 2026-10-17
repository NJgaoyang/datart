import { DASHBOARD_UI_TOKENS as T } from '../dashboardUiTokens';

describe('dashboard interaction sizing', () => {
  it('provides a larger touch target than the mouse target', () => {
    expect(T.touchActionSize).toBeGreaterThanOrEqual(44);
    expect(T.touchActionSize).toBeGreaterThan(T.actionButtonHeight);
  });
  it('keeps narrow controls and compact toolbars on independent thresholds', () => {
    expect(T.compactToolbarWidth).toBeGreaterThan(T.compactFilterWidth);
  });
});
