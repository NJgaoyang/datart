/** Fail closed at the live dashboard query boundary.
 *
 * Legacy template conversion happens only through the offline migration tools.
 * A missing migration mode must not enable the old field-name query path.
 * The standalone ChartDataRequestBuilder retains older non-live callers until
 * chart preview, export and share payloads all carry the explicit mode.
 */
export function assertStrictChartView(
  view: { migrationMode?: string } | null | undefined,
): void {
  if (view?.migrationMode !== 'STRICT') {
    throw new Error('STRICT_ONLY_CHART_VIEW_REQUIRED');
  }
}
