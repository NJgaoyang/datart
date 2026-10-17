/** Only row-additive measures may be summed from rendered rows.
 * AVG, distinct counts and computed ratios require a separate unpaginated
 * server total query; never show a mathematically wrong local total.
 */
export const canSumTableSummary = (field: {
  aggregate?: string;
  category?: string;
  expression?: string;
}): boolean =>
  field.aggregate === 'SUM' &&
  field.category?.toLowerCase() !== 'computed' &&
  !field.expression;

/** A sum of visible rows is not a dataset total when pagination hides rows. */
export const isFullTableResult = (
  pageInfo: { pageNo?: number; total?: number } | undefined,
  returnedRows: number,
): boolean =>
  !pageInfo ||
  ((pageInfo.pageNo ?? 1) === 1 &&
    pageInfo.total !== undefined &&
    pageInfo.total <= returnedRows);
