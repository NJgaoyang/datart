/** Preview dimensions are local UI state, never persisted to widget pRect/mRect. */
export const MOBILE_PREVIEW_MIN_WIDTH = 280;
export const MOBILE_PREVIEW_MAX_WIDTH = 1024;

export const MOBILE_PREVIEW_PRESETS = [
  { key: '320x568', label: '320 × 568 竖屏', width: 320, height: 568 },
  { key: '340x640', label: '340 × 640 竖屏', width: 340, height: 640 },
  { key: '375x667', label: '375 × 667 竖屏', width: 375, height: 667 },
  { key: '430x932', label: '430 × 932 竖屏', width: 430, height: 932 },
  { key: '667x375', label: '667 × 375 横屏', width: 667, height: 375 },
  { key: '736x414', label: '736 × 414 横屏', width: 736, height: 414 },
  { key: '812x375', label: '812 × 375 横屏', width: 812, height: 375 },
  { key: '768x1024', label: '768 × 1024 平板模拟', width: 768, height: 1024 },
] as const;

export const parseMobilePreviewWidth = (input: string): number | undefined => {
  if (!/^\d+$/.test(input.trim())) return undefined;
  const width = Number(input.trim());
  return Number.isSafeInteger(width) &&
    width >= MOBILE_PREVIEW_MIN_WIDTH &&
    width <= MOBILE_PREVIEW_MAX_WIDTH
    ? width
    : undefined;
};

export const getMobilePreviewPresetKey = (width: number, height: number) =>
  MOBILE_PREVIEW_PRESETS.find(
    preset => preset.width === width && preset.height === height,
  )?.key || 'custom';
