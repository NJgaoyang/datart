import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Form } from 'antd';
import { vi } from 'vitest';
import { BoardContext } from 'app/pages/DashBoardPage/components/BoardProvider/BoardProvider';
import { SelectControllerForm } from '../SelectController';
import { MultiSelectControllerForm } from '../MultiSelectController';
import { TreeControllerForm } from '../TreeController';

const option = {
  value: 'big',
  label: '这是一个特别长的筛选项目名称用来验证移动端显示',
};

describe('narrow mobile filter popups', () => {
  it('opens the mobile single-select popup and preserves the full option title', async () => {
    const onChange = vi.fn();
    render(
      <BoardContext.Provider value={{ isMobile: true } as any}>
        <Form>
          <SelectControllerForm
            name="value"
            options={[option]}
            onChange={onChange}
          />
        </Form>
      </BoardContext.Provider>,
    );
    fireEvent.mouseDown(screen.getByRole('combobox'));
    await waitFor(() => {
      expect(
        document.querySelector(
          '.ant-select-dropdown.datart-mobile-filter-popup',
        ),
      ).not.toBeNull();
      expect(
        document.querySelector('[title="' + option.label + '"]'),
      ).not.toBeNull();
    });
    fireEvent.click(screen.getByText(option.label));
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith('big', expect.anything()),
    );
  });

  it('uses the mobile popup for multiple selections', async () => {
    const onChange = vi.fn();
    render(
      <BoardContext.Provider value={{ isMobile: true } as any}>
        <Form>
          <MultiSelectControllerForm
            name="value"
            options={[option]}
            onChange={onChange}
          />
        </Form>
      </BoardContext.Provider>,
    );
    fireEvent.mouseDown(screen.getByRole('combobox'));
    await waitFor(() => {
      expect(
        document.querySelector(
          '.ant-select-dropdown.datart-mobile-filter-popup',
        ),
      ).not.toBeNull();
      expect(
        document.querySelector('[title="' + option.label + '"]'),
      ).not.toBeNull();
    });
    fireEvent.click(screen.getByText(option.label));
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(['big'], expect.anything()),
    );
  });

  it('renders long tree labels with full titles rather than clipping information', async () => {
    const onChange = vi.fn();
    render(
      <BoardContext.Provider value={{ isMobile: true } as any}>
        <Form>
          <TreeControllerForm
            name="value"
            treeData={[
              { key: 'big', value: 'big', title: option.label } as any,
            ]}
            onChange={onChange}
          />
        </Form>
      </BoardContext.Provider>,
    );
    fireEvent.mouseDown(screen.getByRole('combobox'));
    await waitFor(() => {
      expect(
        document.querySelector(
          '.ant-select-dropdown.datart-mobile-filter-popup',
        ),
      ).not.toBeNull();
      expect(
        document.querySelector(
          '.datart-filter-tree-label[title="' + option.label + '"]',
        ),
      ).not.toBeNull();
    });
    fireEvent.click(screen.getByRole('checkbox'));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(['big']));
  });
});
