import { getHeatmapColor } from '../conditionalStyle';

describe('table heatmap color', () => {
  it('handles null, negative values, and equal ranges', () => {
    expect(getHeatmapColor(null, -10, 10)).toBeUndefined();
    expect(getHeatmapColor(-10, -10, 10)).toBe('rgb(238, 245, 255)');
    expect(getHeatmapColor(10, -10, 10)).toBe('rgb(47, 111, 237)');
    expect(getHeatmapColor(1, 1, 1)).toBe('rgb(143, 178, 246)');
  });
});
