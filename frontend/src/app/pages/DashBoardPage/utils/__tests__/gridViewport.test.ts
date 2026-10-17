import { getAdaptiveGridColsKey, getGridCanvasWidth } from '../gridViewport';

describe('explicit dashboard device mode and canvas width', () => {
  it('does not switch the saved desktop layout merely when the pane narrows', () => {
    for (const width of [1920, 1200, 996, 768, 360])
      expect(getAdaptiveGridColsKey(width)).toBe('lg');
  });
  it('uses a single mobile layout at every container width', () => {
    for (const width of [280, 320, 340, 375, 430, 600, 768, 900, 1200]) {
      expect(getAdaptiveGridColsKey(width, true)).toBe('sm');
      expect(getGridCanvasWidth(width, true)).toBe(width);
    }
  });
  it('keeps a minimum desktop canvas width without changing mobile width', () => {
    expect(getGridCanvasWidth(1366)).toBe(1366);
    expect(getGridCanvasWidth(720)).toBe(768);
    expect(getGridCanvasWidth(340, true)).toBe(340);
  });
});
