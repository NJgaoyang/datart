import {
  getMobilePreviewPresetKey,
  MOBILE_PREVIEW_PRESETS,
  parseMobilePreviewWidth,
} from '../mobilePreviewSize';

describe('mobile dashboard preview viewport', () => {
  it('includes portrait, landscape and tablet simulation while retaining mobile geometry', () => {
    expect(MOBILE_PREVIEW_PRESETS.some(item => item.width > item.height)).toBe(true);
    expect(MOBILE_PREVIEW_PRESETS.some(item => item.width < item.height)).toBe(true);
    expect(MOBILE_PREVIEW_PRESETS.some(item => item.width === 768)).toBe(true);
    expect(getMobilePreviewPresetKey(812, 375)).toBe('812x375');
    expect(getMobilePreviewPresetKey(601, 640)).toBe('custom');
  });

  it('accepts integer custom widths only within a safe preview range', () => {
    expect(parseMobilePreviewWidth(' 600 ')).toBe(600);
    expect(parseMobilePreviewWidth('280')).toBe(280);
    expect(parseMobilePreviewWidth('1024')).toBe(1024);
    for (const value of ['', '0', '279', '1025', '-500', '600.5', 'Infinity', 'abc']) {
      expect(parseMobilePreviewWidth(value)).toBeUndefined();
    }
  });
});
