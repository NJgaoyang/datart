import { shouldUseMobileShareLayout } from '../shareMobileLayout';

describe('shared dashboard mobile layout selection', () => {
  it('chooses one mobile layout across mobile widths', () => {
    for (const w of [280, 320, 340, 375, 430, 768, 820, 900, 960]) {
      expect(shouldUseMobileShareLayout(w, 'auto', 'share')).toBe(true);
    }
  });
  it('keeps desktop and export layouts unchanged', () => {
    expect(shouldUseMobileShareLayout(961, 'auto', 'share')).toBe(false);
    expect(shouldUseMobileShareLayout(375, 'free', 'share')).toBe(false);
    expect(shouldUseMobileShareLayout(375, 'auto', 'schedule')).toBe(false);
  });
});