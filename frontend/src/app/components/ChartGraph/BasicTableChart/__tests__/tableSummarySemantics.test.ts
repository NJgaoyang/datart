import { canSumTableSummary, isFullTableResult } from '../tableSummarySemantics';

describe('table summary semantics', () => {
  it('allows additive SUM measures', () => {
    expect(canSumTableSummary({ aggregate: 'SUM', category: 'measure' })).toBe(true);
  });

  it('rejects local sums of ratios and nonadditive measures', () => {
    expect(canSumTableSummary({ aggregate: 'SUM', category: 'computed', expression: 'a / b' })).toBe(false);
    expect(canSumTableSummary({ aggregate: 'AVG' })).toBe(false);
    expect(canSumTableSummary({ aggregate: 'COUNT_DISTINCT' })).toBe(false);
    expect(canSumTableSummary({ aggregate: 'SUM', expression: 'SUM(a)/SUM(b)' })).toBe(false);
  });
  it('does not mislabel a partial page as a full report total', () => {
    expect(isFullTableResult({ pageNo: 1, total: 50 }, 10)).toBe(false);
    expect(isFullTableResult({ pageNo: 2, total: 50 }, 10)).toBe(false);
    expect(isFullTableResult({ pageNo: 1, total: 10 }, 10)).toBe(true);
  });

});
