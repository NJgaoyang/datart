import {
  disambiguateComputedFieldNames,
  findComputedFieldByKey,
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

  it('keeps both JOIN sources when the physical leaf names and labels repeat', () => {
    const fields = disambiguateComputedFieldNames([
      { name: 'amount', label: '金额', path: ['sales', 'orders', 'amount'] },
      { name: 'amount', label: '金额', path: ['sales', 'refunds', 'amount'] },
    ]);
    expect(fields.map(field => field.label)).toEqual([
      '金额（sales.orders.amount）',
      '金额（sales.refunds.amount）',
    ]);
    expect(
      findComputedFieldByKey(fields, ['sales', 'refunds', 'amount']),
    ).toBe(fields[1]);
    expect(findComputedFieldByKey(fields, 'amount')).toBeUndefined();

    const displayed =
      'SUM([金额（sales.orders.amount）]) - SUM([金额（sales.refunds.amount）])';
    const saved = toQueryExpression(displayed, fields);
    expect(saved).toBe(
      'SUM([sales].[orders].[amount]) - SUM([sales].[refunds].[amount])',
    );
    expect(toDisplayExpression(saved, fields)).toBe(displayed);
    expect(toDisplayExpression('[amount]', fields)).toBe('[amount]');
  });

  it('uses the selected full path even when the JOIN fields have distinct Chinese names', () => {
    const fields = [
      { name: 'amount', label: '订单金额', path: ['orders', 'amount'] },
      { name: 'amount', label: '退款金额', path: ['refunds', 'amount'] },
    ];
    const selected = findComputedFieldByKey(fields, ['refunds', 'amount']);
    expect(selected?.label).toBe('退款金额');
    expect(toQueryExpression(`[${selected?.label}]`, fields)).toBe(
      '[refunds].[amount]',
    );
    expect(toDisplayExpression('[orders] . [amount]', fields)).toBe(
      '[订单金额]',
    );
  });

  it('continues to open legacy unqualified expressions when the field is unique', () => {
    const fields = [
      { name: 'city', label: '城市', path: ['orders', 'city'] },
    ];
    expect(toDisplayExpression('UPPER([city])', fields)).toBe('UPPER([城市])');
    expect(toQueryExpression('UPPER([城市])', fields)).toBe(
      'UPPER([orders].[city])',
    );
    expect(toDisplayExpression('[unrelated].[city]', fields)).toBe(
      '[unrelated].[city]',
    );
  });

  it('does not rewrite field-like text inside string literals or comments', () => {
    const displayed =
      "CONCAT('[城市]', [城市], 'it''s [城市]') /* [城市] */ -- [城市]";
    expect(toQueryExpression(displayed, fieldNames)).toBe(
      "CONCAT('[城市]', [city], 'it''s [城市]') /* [城市] */ -- [城市]",
    );
    expect(
      toDisplayExpression("CONCAT('[city]', [city])", fieldNames),
    ).toBe("CONCAT('[city]', [城市])");
  });

  it('does not split a SQL output name containing a literal dot', () => {
    const fields = [{ name: 'orders.amount', label: '金额' }];
    expect(toQueryExpression('[金额]', fields)).toBe('[orders.amount]');
    expect(toDisplayExpression('[orders.amount]', fields)).toBe('[金额]');
    expect(toDisplayExpression('[orders].[amount]', fields)).toBe(
      '[orders].[amount]',
    );
  });

  it('round-trips closing brackets in field names and display labels', () => {
    const fields = [{ name: 'a]b', label: '金额]原始', path: ['orders', 'a]b'] }];
    expect(toQueryExpression('[金额]]原始]', fields)).toBe('[orders].[a]]b]');
    expect(toDisplayExpression('[orders].[a]]b]', fields)).toBe('[金额]]原始]');
  });
});
