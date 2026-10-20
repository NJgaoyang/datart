import { mobileMetricTotal } from '../mobileMetricTotals';

const pv = { colName: 'pv', category: 'field', aggregate: 'SUM' } as any;
const uv = { colName: 'uv', category: 'field', aggregate: 'SUM' } as any;
const ratio = { colName: 'ratio', fieldId: 'ratio-id', category: 'computedField' } as any;
const fields = [pv, uv, ratio];
const computed = [{ name: 'ratio', fieldId: 'ratio-id', expression: '[uv] / [pv]' }];
const rows = (values: Record<string, number | null>[]) =>
  values.map(value => ({ getCell: field => value[field.colName] }));

describe('mobile totals', () => {
  it('computes a ratio of totals instead of adding city ratios', () => {
    const data = rows([{ pv: 10, uv: 2 }, { pv: 40, uv: 5 }]);
    expect(mobileMetricTotal(pv, fields, computed, data)).toBe(50);
    expect(mobileMetricTotal(uv, fields, computed, data)).toBe(7);
    expect(mobileMetricTotal(ratio, fields, computed, data)).toBe(0.14);
  });

  it('does not invent totals for averages, complex formulas or missing operands', () => {
    const data = rows([{ pv: 10, uv: 2 }, { pv: 40, uv: 5 }]);
    expect(mobileMetricTotal({ ...pv, aggregate: 'AVG' }, fields, computed, data)).toBeUndefined();
    expect(mobileMetricTotal(ratio, fields, [{ ...computed[0], expression: '[uv] / [pv] + 1' }], data)).toBeUndefined();
    expect(mobileMetricTotal(ratio, [pv, ratio], computed, data)).toBeUndefined();
  });

  it('returns an empty value for a zero denominator', () => {
    expect(mobileMetricTotal(ratio, fields, computed, rows([{ pv: 0, uv: 2 }]))).toBeNull();
  });

  it('understands aggregated ratios and a zero-denominator guard', () => {
    const data = rows([{ pv: 10, uv: 2 }, { pv: 40, uv: 5 }]);
    for (const expression of ['SUM([uv])/SUM([pv])', 'SUM(uv)/NULLIF(SUM(pv), 0)']) {
      expect(mobileMetricTotal(ratio, fields, [{ ...computed[0], expression }], data)).toBe(0.14);
    }
    expect(mobileMetricTotal(ratio, fields, [{ ...computed[0], expression: 'SUM(uv)/NULLIF(SUM(pv), 1)' }], data)).toBeUndefined();
  });
});
