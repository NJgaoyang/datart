import { getJoinConditionWidths, getJoinFieldWidth } from '../joinLayout';

describe('data source join editor adaptive widths', () => {
  it('sizes by visible field name, not the whole database-qualified path', () => {
    expect(getJoinFieldWidth(['s_order_daily_report','city'])).toBe(112);
    expect(getJoinFieldWidth(['sales', 'very_long_field_name_from_dataset'])).toBeLessThanOrEqual(300);
    expect(getJoinFieldWidth(['sales','城市'])).toBe(112);
  });

  it('holds all join rows to one stable pair of measured widths', () => {
    const conditions = [
      {left:['db','city'],right:['db','城市']},
      {left:['db','user_long_identifier'],right:['db','登录名']},
    ];
    const widths = getJoinConditionWidths(conditions);
    expect(widths.left).toBeGreaterThan(112);
    expect(widths.right).toBe(112);
    expect(getJoinConditionWidths()).toEqual({left:112,right:112});
  });
});