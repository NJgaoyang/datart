import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Form, Input } from 'antd';
import PasswordModal from 'app/pages/SharePage/components/PasswordModal';
import { afterEach, beforeEach, vi } from 'vitest';
import { Confirm } from '../Confirm';
import { ModalForm } from '../ModalForm';

describe('Ant Design 6 modal visibility', () => {
  beforeEach(() => {
    // JSDOM cannot measure the scrollbar pseudo-elements used by modal scroll locking.
    const getComputedStyle = window.getComputedStyle;
    vi.spyOn(window, 'getComputedStyle').mockImplementation(element =>
      getComputedStyle(element),
    );
  });

  afterEach(() => vi.restoreAllMocks());

  it('opens an existing save form and submits its values', async () => {
    const onSave = vi.fn();
    render(
      <ModalForm open title="保存数据集" okText="保存" onSave={onSave}>
        <Form.Item
          name="name"
          rules={[{ required: true, message: '请输入数据集名称' }]}
        >
          <Input aria-label="数据集名称" />
        </Form.Item>
      </ModalForm>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));
    await screen.findByText('请输入数据集名称');
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('textbox', { name: '数据集名称' }), {
      target: { value: '销售数据' },
    });
    fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({ name: '销售数据' }),
    );
  });

  it('opens a closed form through the current open property', () => {
    const { rerender } = render(<ModalForm open={false} onSave={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    rerender(<ModalForm open onSave={vi.fn()} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('opens the existing confirmation and preserves cancellation', () => {
    const onCancel = vi.fn();
    render(
      <Confirm open title="关闭数据集" cancelText="取消" onCancel={onCancel} />,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /取\s*消/ }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('opens the share access-code dialog and submits the code', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <PasswordModal open={false} onChange={onChange} />,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    rerender(<PasswordModal open onChange={onChange} />);
    const dialog = screen.getByRole('dialog');
    fireEvent.change(dialog.querySelector('input')!, {
      target: { value: 'share-code' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('share-code'));
  });
});
