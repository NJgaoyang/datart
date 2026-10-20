import { ChartDataSectionField } from 'app/types/ChartConfig';
import { ChartDataViewMeta } from 'app/types/ChartDataViewMeta';

type Row = { getCell: (field: ChartDataSectionField) => unknown };

/** Return undefined when a total cannot be derived safely from grouped rows. */
export function mobileMetricTotal(
  field: ChartDataSectionField,
  fields: ChartDataSectionField[],
  computedFields: ChartDataViewMeta[],
  rows: Row[],
): number | null | undefined {
  const sum = (column: ChartDataSectionField): number | null | undefined => {
    let total = 0;
    let found = false;
    for (const row of rows) {
      const value = row.getCell(column);
      if (value == null) continue;
      if (value === '' || !Number.isFinite(Number(value))) return undefined;
      total += Number(value);
      found = true;
    }
    return found ? total : null;
  };

  const computed = computedFields.find(meta => meta.expression && (
    field.fieldId ? meta.fieldId === field.fieldId : meta.name === field.colName
  ));
  const expression = field.expression || computed?.expression;
  if (expression) {
    // Only direct ratios of additive columns can be reconstructed safely.
    const operand = '(\\[[^\\]]+\\]|`[^`]+`|[a-zA-Z_][\\w]*)';
    const direct = new RegExp(`^\\s*${operand}\\s*/\\s*${operand}\\s*$`);
    const prefix = `^\\s*SUM\\s*\\(\\s*${operand}\\s*\\)\\s*/\\s*`;
    const denominatorPattern = `SUM\\s*\\(\\s*${operand}\\s*\\)`;
    const match = expression.match(direct)
      || expression.match(new RegExp(`${prefix}${denominatorPattern}\\s*$`, 'i'))
      || expression.match(new RegExp(`${prefix}NULLIF\\s*\\(\\s*${denominatorPattern}\\s*,\\s*0\\s*\\)\\s*$`, 'i'));
    if (!match) return undefined;
    const names = [match[1], match[2]].map(name => name.replace(/^(?:\[|`)|(?:\]|`)$/g, ''));
    const operands = names.map(name => fields.filter(candidate =>
      candidate.aggregate === 'SUM' && candidate.category === 'field' &&
      (candidate.colName === name || candidate.originName === name || candidate.path?.join('.') === name),
    ));
    if (operands.some(matches => matches.length !== 1)) return undefined;
    const numerator = sum(operands[0][0]);
    const denominator = sum(operands[1][0]);
    if (numerator === undefined || denominator === undefined) return undefined;
    return numerator === null || denominator === null || denominator === 0 ? null : numerator / denominator;
  }
  if (field.category !== 'field' || !['SUM', 'COUNT'].includes(field.aggregate || '')) return undefined;
  return sum(field);
}
