import { ChartDataSectionField } from 'app/types/ChartConfig';
import { getFieldActionConfig } from '../useFieldActionModal';

describe('getFieldActionConfig', () => {
  const originalConfig = {
    uid: 'field-1',
    colName: 'city',
    type: 'STRING',
    category: 'field',
  } as ChartDataSectionField;

  it('keeps the original field when the action modal is confirmed unchanged', () => {
    expect(getFieldActionConfig({}, originalConfig)).toBe(originalConfig);
    expect(getFieldActionConfig(undefined, originalConfig)).toBe(
      originalConfig,
    );
  });

  it('uses the changed field configuration', () => {
    const changedConfig = { ...originalConfig, alias: { name: '城市' } };

    expect(getFieldActionConfig(changedConfig, originalConfig)).toBe(
      changedConfig,
    );
  });
});
