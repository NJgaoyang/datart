import { ChartDataViewFieldCategory, DataViewFieldType } from 'app/constants';
import { DATE_LEVEL_DELIMITER } from 'globalConstants';

const DATE_LEVEL_TYPES: Record<string, DataViewFieldType> = {
  AGG_DATE_YEAR: DataViewFieldType.DATE,
  AGG_DATE_QUARTER: DataViewFieldType.DATE,
  AGG_DATE_MONTH: DataViewFieldType.DATE,
  AGG_DATE_WEEK: DataViewFieldType.DATE,
  AGG_DATE_DAY: DataViewFieldType.DATE,
  AGG_DATE_HOUR: DataViewFieldType.DATETIME,
  AGG_DATE_MINUTE: DataViewFieldType.DATETIME,
  AGG_DATE_SECOND: DataViewFieldType.DATETIME,
};

export function getDateLevelFieldType(
  field?: {
    category?: string;
    name?: string;
    colName?: string;
    expression?: string;
    type?: DataViewFieldType;
  },
  fallback?: DataViewFieldType,
) {
  if (
    field?.category !== ChartDataViewFieldCategory.DateLevelComputedField
  ) {
    return fallback ?? field?.type;
  }

  const dateLevel = [field.colName, field.name, field.expression]
    .filter(Boolean)
    .map(value =>
      String(value)
        .split(DATE_LEVEL_DELIMITER)
        .pop()!
        .match(
          /AGG_DATE_(YEAR|QUARTER|MONTH|WEEK|DAY|HOUR|MINUTE|SECOND)(?:_NATIVE)?/i,
        )?.[0],
    )
    .find(Boolean)
    ?.replace(/_NATIVE$/i, '')
    .toUpperCase();

  return DATE_LEVEL_TYPES[dateLevel || ''] ?? fallback ?? field.type;
}
