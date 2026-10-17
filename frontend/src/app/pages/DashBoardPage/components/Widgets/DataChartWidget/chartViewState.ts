/** Separate loading, empty results and query errors without treating
 * an unanswered query as zero rows or leaking SQL details to viewers.
 */
export type ChartViewState = 'loading' | 'ready' | 'empty' | 'error';

export const getChartViewState = ({
  loading,
  rendered,
  rows,
  failed,
}: {
  loading: boolean;
  rendered: boolean;
  rows?: readonly unknown[];
  failed: boolean;
}): ChartViewState => {
  if (failed) return 'error';
  if (loading || !rendered || rows === undefined) return 'loading';
  if (rows.length === 0) return 'empty';
  return 'ready';
};
