import { fireEvent, render, waitFor } from '@testing-library/react';
import { Form } from 'antd';
import { BoardContext } from 'app/pages/DashBoardPage/components/BoardProvider/BoardProvider';
import { SelectControllerForm } from '../SelectController';
import { MultiSelectControllerForm } from '../MultiSelectController';
import { TreeControllerForm } from '../TreeController';

const option = { value: 'big', label: '这是一个特别长的筛选项目名称用来验证移动端显示' };

describe('narrow mobile filter popups', () => {
  it('opens the mobile single-select popup and preserves the full option title', async () => {
    const { container } = render(
      <BoardContext.Provider value={{ isMobile: true } as any}>
        <Form>
          <SelectControllerForm name="value" options={[option]} onChange={() => {}} />
        </Form>
      </BoardContext.Provider>,
    );
    fireEvent.mouseDown(container.querySelector('.ant-select-selector')!);
    await waitFor(() => {
      expect(document.querySelector('.ant-select-dropdown.datart-mobile-filter-popup')).not.toBeNull();
      expect(document.querySelector('[title="' + option.label + '"]')).not.toBeNull();
    });
  });

  it('uses the mobile popup for multiple selections', async () => {
    const { container } = render(
      <BoardContext.Provider value={{ isMobile: true } as any}>
        <Form>
          <MultiSelectControllerForm name="value" options={[option]} onChange={() => {}} />
        </Form>
      </BoardContext.Provider>,
    );
    fireEvent.mouseDown(container.querySelector('.ant-select-selector')!);
    await waitFor(() => {
      expect(document.querySelector('.ant-select-dropdown.datart-mobile-filter-popup')).not.toBeNull();
      expect(document.querySelector('[title="' + option.label + '"]')).not.toBeNull();
    });
  });

  it('renders long tree labels with full titles rather than clipping information', async () => {
    const { container } = render(
      <BoardContext.Provider value={{ isMobile: true } as any}>
        <Form>
          <TreeControllerForm
            name="value"
            treeData={[{ key: 'big', value: 'big', title: option.label } as any]}
            onChange={() => {}}
          />
        </Form>
      </BoardContext.Provider>,
    );
    fireEvent.mouseDown(container.querySelector('.ant-select-selector')!);
    await waitFor(() => {
      expect(document.querySelector('.ant-select-dropdown.datart-mobile-filter-popup')).not.toBeNull();
      expect(document.querySelector('.datart-filter-tree-label[title="' + option.label + '"]')).not.toBeNull();
    });
  });
});