import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataViewFieldType } from 'app/constants';
import { vi } from 'vitest';
import { Column } from '../../../../slice/types';
import DataModelComputerFieldNode from '../DataModelComputerFieldNode';
import DataModelNode from '../DataModelNode';

vi.mock('app/hooks/useI18NPrefix', () => ({
  default: () => (key: string) => key,
}));

const field: Column = {
  name: 'customer_id',
  type: DataViewFieldType.STRING,
  customName: '客户编号',
  fieldId: 'refunds-customer-id',
  path: ['sales', 'refunds', 'customer_id'],
};

function renderField() {
  const onEditDisplayName = vi.fn();
  const onMoveToHierarchy = vi.fn();
  const onNodeTypeChange = vi.fn();
  render(
    <DragDropContext onDragEnd={vi.fn()}>
      <Droppable droppableId="fields">
        {provided => (
          <div ref={provided.innerRef} {...provided.droppableProps}>
            <DataModelNode
              node={field}
              onEditDisplayName={onEditDisplayName}
              onMoveToHierarchy={onMoveToHierarchy}
              onNodeTypeChange={onNodeTypeChange}
            />
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>,
  );
  return { onEditDisplayName, onMoveToHierarchy, onNodeTypeChange };
}

describe('dataset field keyboard actions', () => {
  it('opens display-name editing without hover and preserves the field identity', async () => {
    const user = userEvent.setup();
    const { onEditDisplayName } = renderField();
    const button = screen.getByRole('button', {
      name: 'setDisplayName: 客户编号',
    });
    act(() => button.focus());
    await user.keyboard('{Enter}');
    expect(onEditDisplayName).toHaveBeenCalledWith(field);
    expect(screen.getByText('sales.refunds.customer_id')).toBeTruthy();
  });

  it('keeps hierarchy actions reachable through the keyboard-opened menu', async () => {
    const user = userEvent.setup();
    const { onMoveToHierarchy } = renderField();
    act(() => {
      screen.getByRole('button', { name: 'moreActions: 客户编号' }).focus();
    });
    await user.keyboard('{Enter}');
    await user.click(
      await screen.findByRole('menuitem', { name: 'addToHierarchy' }),
    );
    expect(onMoveToHierarchy).toHaveBeenCalledWith(field);
  });

  it('opens the type selector with a keyboard-focusable button', async () => {
    const user = userEvent.setup();
    const { onNodeTypeChange } = renderField();
    act(() => {
      screen.getByRole('button', { name: 'typeAndCategory: 客户编号' }).focus();
    });
    await user.keyboard('{Enter}');
    await user.click(
      await screen.findByRole('menuitem', { name: 'columnType.numeric' }),
    );
    expect(onNodeTypeChange).toHaveBeenCalledWith(['NUMERIC'], 'customer_id');
  });

  it('retains confirmation before deleting a computed field', async () => {
    const user = userEvent.setup();
    const menuClick = vi.fn();
    const computedField = {
      name: 'net_amount',
      customName: '净额',
      type: DataViewFieldType.NUMERIC,
      expression: 'amount - refund_amount',
    };
    render(
      <DataModelComputerFieldNode node={computedField} menuClick={menuClick} />,
    );
    await user.click(screen.getByRole('button', { name: 'delete: 净额' }));
    expect(menuClick).not.toHaveBeenCalled();
    await user.click(
      await screen.findByRole('button', { name: 'delete', exact: true }),
    );
    expect(menuClick).toHaveBeenCalledWith(computedField, 'delete');
  });
});
