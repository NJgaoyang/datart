import {
  toDisplayExpression,
  toQueryExpression,
} from '../computedFieldExpression';

const fieldNames = [
  { name: 'month_cn', label: '中文月份' },
  { name: 'city', label: '城市' },
];

describe('computed field expression display names', () => {
  it('shows field display names without changing functions', () => {
    expect(toDisplayExpression('CONCAT([month_cn], [city])', fieldNames)).toBe(
      'CONCAT([中文月份], [城市])',
    );
  });

  it('restores query field identifiers before saving', () => {
    expect(toQueryExpression('CONCAT([中文月份], [城市])', fieldNames)).toBe(
      'CONCAT([month_cn], [city])',
    );
  });
});
