import { getChartViewState } from '../chartViewState';

describe('dashboard chart data states', () => {
  it('does not mistake pending queries for empty data', () => {
    expect(getChartViewState({ loading: true, rendered: true, rows: [], failed: false })).toBe('loading');
    expect(getChartViewState({ loading: false, rendered: true, failed: false })).toBe('loading');
  });

  it('distinguishes an empty result and an ordinary chart', () => {
    expect(getChartViewState({ loading: false, rendered: true, rows: [], failed: false })).toBe('empty');
    expect(getChartViewState({ loading: false, rendered: true, rows: [[1]], failed: false })).toBe('ready');
  });

  it('shows a generic error when a per-widget query fails', () => {
    expect(getChartViewState({ loading: false, rendered: true, rows: [], failed: true })).toBe('error');
  });
});
