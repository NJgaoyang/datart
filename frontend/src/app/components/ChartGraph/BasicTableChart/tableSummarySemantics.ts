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
