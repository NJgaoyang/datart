import { getLayerBulkActions } from '../layerBulkActions';

describe('batch layer lock and mobile visibility', () => {
  const widgets = {
    a: { config: { lock: true, mVisible: false } },
    b: { config: { lock: false, mVisible: true } },
  };
  it('ignores nonexistent IDs rather than creating phantom widget data', () => {
    const actions = getLayerBulkActions(['a', 'missing'], widgets);
    expect(actions.ids).toEqual(['a']);
    expect(actions.nextLock).toBe(false);
    expect(actions.nextMobileVisible).toBe(true);
  });
  it('normalizes mixed selected states to a single undoable operation', () => {
    expect(getLayerBulkActions(['a', 'b'], widgets)).toEqual({
      ids: ['a', 'b'], nextLock: true, nextMobileVisible: false,
    });
  });
  it('does not mutate widget metadata when deriving an action', () => {
    getLayerBulkActions(['a', 'b'], widgets);
    expect(widgets.a.config.mVisible).toBe(false);
    expect(widgets.b.config.lock).toBe(false);
  });
});
