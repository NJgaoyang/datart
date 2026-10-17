import { updateAutoWidgetsRect } from '../widget';
import type { Widget } from '../../types/widgetTypes';

const makeWidget = (id: string, width: number, height: number) =>
  ({ id, config: { pRect: { x: 8, y: 8, width, height } } } as Widget);

describe('new dashboard widget placement', () => {
  it('places a new widget below the existing bottom edge', () => {
    const input = [makeWidget('new', 20, 6)];
    const result = updateAutoWidgetsRect(input, [
      { i: 'existing', x: 4, y: 15, w: 18, h: 7 },
    ]);
    expect(result[0].config.pRect).toEqual({
      x: 0, y: 22, width: 20, height: 6,
    });
    expect(input[0].config.pRect.x).toBe(8);
  });

  it('packs batches left to right and wraps after the widest row', () => {
    const result = updateAutoWidgetsRect([
      makeWidget('a', 40, 10),
      makeWidget('b', 32, 6),
      makeWidget('c', 30, 5),
    ], []);
    expect(result.map(widget => widget.config.pRect)).toEqual([
      { x: 0, y: 0, width: 40, height: 10 },
      { x: 40, y: 0, width: 32, height: 6 },
      { x: 0, y: 10, width: 30, height: 5 },
    ]);
  });

  it('keeps oversized widgets within the 72-column grid', () => {
    const result = updateAutoWidgetsRect([makeWidget('wide', 200, 3)], []);
    expect(result[0].config.pRect).toEqual({
      x: 0, y: 0, width: 72, height: 3,
    });
  });
});
