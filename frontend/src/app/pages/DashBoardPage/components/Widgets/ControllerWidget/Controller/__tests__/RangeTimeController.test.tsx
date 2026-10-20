import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Form } from 'antd';
import { RangeTimeControllerForm } from '../RangeTimeController';
import { BoardContext } from 'app/pages/DashBoardPage/components/BoardProvider/BoardProvider';
import { TimeControllerForm } from '../TimeController';

describe('mobile range date filter', () => {

  it('mounts the mobile range calendar with a viewport-scoped popup class', async () => {
    const { container } = render(
      <BoardContext.Provider value={{ isMobile: true } as any}>
        <Form>
          <RangeTimeControllerForm name="value" label="日期：" pickerType={'date' as any} onChange={() => {}} />
        </Form>
      </BoardContext.Provider>,
    );
    const input = container.querySelector<HTMLInputElement>('.ant-picker-range input');
    expect(input).not.toBeNull();
    fireEvent.mouseDown(input!);
    fireEvent.click(input!);
    await waitFor(() =>
      expect(document.querySelector('.ant-picker-dropdown.datart-mobile-date-popup')).not.toBeNull(),
    );
  });

  it('uses the same compact mobile popup for single-date filters', async () => {
    const { container } = render(
      <BoardContext.Provider value={{ isMobile: true } as any}>
        <Form>
          <TimeControllerForm name="value" label="日期：" pickerType={'date' as any} onChange={() => {}} />
        </Form>
      </BoardContext.Provider>,
    );
    const input = container.querySelector<HTMLInputElement>('.ant-picker input');
    expect(input).not.toBeNull();
    fireEvent.mouseDown(input!);
    fireEvent.click(input!);
    await waitFor(() =>
      expect(document.querySelector('.ant-picker-dropdown.datart-mobile-date-popup')).not.toBeNull(),
    );
  });

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