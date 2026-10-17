import { render, waitFor } from '@testing-library/react';
import { Form } from 'antd';
import { RangeTimeControllerForm } from '../RangeTimeController';

describe('mobile range date filter', () => {
  it('keeps the range control identifiable without changing the date values', async () => {
    const { container } = render(
      <div className="datart-mobile-board">
        <Form initialValues={{ value: ['2026-10-16', '2026-10-17'] }}>
          <RangeTimeControllerForm
            name="value"
            label="日期："
            pickerType={'date' as any}
            onChange={() => {}}
          />
        </Form>
      </div>,
    );
    const item = container.querySelector('.ant-form-item.mobile-range-time-form');
    expect(item).not.toBeNull();
    expect(item?.querySelector('.ant-form-item-label')?.textContent).toContain('日期');
    await waitFor(() => {
      const inputs = [...container.querySelectorAll<HTMLInputElement>('.ant-picker-range input')];
      expect(inputs.map(input => input.value)).toEqual([
        '2026-10-16',
        '2026-10-17',
      ]);
    });
  });
});
