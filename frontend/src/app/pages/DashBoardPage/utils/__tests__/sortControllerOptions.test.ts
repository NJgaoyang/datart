import { sortControllerOptions } from '../sortControllerOptions';

const options = (...values: string[]) => values.map(value => ({ key: value, label: value }));
const labels = (values: ReturnType<typeof options>) => values.map(value => value.label);

describe('controller option ordering', () => {
  it('shows the newest month first in automatic mode', () => {
    expect(labels(sortControllerOptions(options('2026-05', '2025-04', '2026-10', '2026-2'), 'auto')))
      .toEqual(['2026-10', '2026-05', '2026-2', '2025-04']);
  });
  it('sorts numeric values numerically and supports descending order', () => {
    expect(labels(sortControllerOptions(options('10', '2', '1'), 'auto'))).toEqual(['1', '2', '10']);
    expect(labels(sortControllerOptions(options('10', '2', '1'), 'desc'))).toEqual(['10', '2', '1']);
  });
  it('sorts text without modifying the original options or their keys', () => {
    const original = [{ key: '2', label: '苏州' }, { key: '1', label: '南京' }];
    expect(sortControllerOptions(original, 'asc').map(item => item.key)).toEqual(['1', '2']);
    expect(original.map(item => item.key)).toEqual(['2', '1']);
  });
  it('preserves legacy and custom order by default', () => {
    const original = options('b', 'a');
    expect(sortControllerOptions(original, undefined)).toBe(original);
    expect(sortControllerOptions(original, 'auto', true)).toBe(original);
    expect(sortControllerOptions(original, 'original')).toBe(original);
    expect(labels(sortControllerOptions(original, 'asc', true))).toEqual(['a', 'b']);
  });
});
