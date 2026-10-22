import { ChartDataSectionField } from 'app/types/ChartConfig';
import { findChartFieldByResultColumn } from '../internalChartHelper';

describe('findChartFieldByResultColumn', () => {
  const dimension = {
    colName: 'city_name_std',
    aggregate: 'NONE',
  } as ChartDataSectionField;
  const measure = {
    colName: 'disabled_door_cnt',
    aggregate: 'SUM',
  } as ChartDataSectionField;
  const fields = [dimension, measure];

  it('matches a dimension by its technical column name', () => {
    expect(findChartFieldByResultColumn(fields, 'city_name_std')).toBe(
      dimension,
    );
  });

  it('matches aggregated measures by their result alias', () => {
    expect(findChartFieldByResultColumn(fields, 'SUM(disabled_door_cnt)')).toBe(
      measure,
    );
  });

  it('ignores identifier case and surrounding whitespace', () => {
    expect(
      findChartFieldByResultColumn(fields, ' sum(disabled_door_cnt) '),
    ).toBe(measure);
  });

  it('returns undefined when the result column is unknown', () => {
    expect(
      findChartFieldByResultColumn(fields, 'SUM(other_column)'),
    ).toBeUndefined();
    expect(findChartFieldByResultColumn(fields, '')).toBeUndefined();
    expect(findChartFieldByResultColumn(undefined, 'city_name_std')).toBe(
      undefined,
    );
  });

  it('supports hierarchy column names serialized as arrays', () => {
    const nested = {
      colName: 'orders.total',
      aggregate: 'NONE',
    } as ChartDataSectionField;
    expect(findChartFieldByResultColumn([nested], ['orders', 'total'])).toBe(
      nested,
    );
  });
});
