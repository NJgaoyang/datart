import { describe, expect, it } from 'vitest';
import { assertStrictChartView } from '../strictChartView';

describe('live dashboard STRICT view gate', () => {
  it('accepts an explicitly STRICT view', () => {
    expect(() => assertStrictChartView({ migrationMode: 'STRICT' })).not.toThrow();
  });

  it.each([
    undefined,
    null,
    {},
    { migrationMode: undefined },
    { migrationMode: 'COMPAT' },
    { migrationMode: 'strict' },
    { migrationMode: '' },
  ])('fails closed for a missing, legacy or invalid mode: %s', view => {
    expect(() => assertStrictChartView(view)).toThrow(
      'STRICT_ONLY_CHART_VIEW_REQUIRED',
    );
  });
});
