import { getAdaptiveGridColsKey } from '../gridViewport';

describe('automatic dashboard container breakpoints', () => {
  it('uses the full desktop geometry only when the actual canvas has room', () => {
    expect(getAdaptiveGridColsKey(1600)).toBe('lg');
    expect(getAdaptiveGridColsKey(1200)).toBe('lg');
    expect(getAdaptiveGridColsKey(997)).toBe('lg');
  });
  it('uses the separately saved compact layout in split panes and tablets', () => {
    expect(getAdaptiveGridColsKey(996)).toBe('sm');
    expect(getAdaptiveGridColsKey(800)).toBe('sm');
    expect(getAdaptiveGridColsKey(360)).toBe('sm');
  });
  it('does not switch layout before the first positive width measurement', () => {
    expect(getAdaptiveGridColsKey(0)).toBe('lg');
  });
});
