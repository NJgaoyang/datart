import { fireEvent, render, screen } from '@testing-library/react';
import { DataViewFieldType } from 'app/constants';
import { describe, expect, it, vi } from 'vitest';
import { SchemaTable } from '../SchemaTable';

vi.mock('app/components', () => ({
  ToolbarButton: ({ children, ...props }) => <button {...props}>{children}</button>,
}));
vi.mock('app/components/VirtualTable', () => ({
  VirtualTable: ({ columns }) => (
    <table><thead><tr>{columns.map((column, index) => (
      <th key={index}>{column.title}</th>
    ))}</tr></thead></table>
  ),
}));
vi.mock('../SetFieldType', () => ({
  default: ({ onChange }) => (
    <button onClick={() => onChange(['STRING'])}>Change field type</button>
  ),
}));

describe('dataset preview edit permissions', () => {
  it('does not expose type or permission edits in read-only previews', () => {
    const onChange = vi.fn();
    const onSchemaTypeChange = vi.fn(() => onChange);
    const getExtraHeaderActions = vi.fn(() => [
      <button key="permissions">Edit column permissions</button>,
    ]);
    const props = {
      height: 300,
      width: 600,
      model: { amount: { name: ['amount'], type: DataViewFieldType.NUMERIC } },
      hierarchy: {},
      dataSource: [],
      onSchemaTypeChange,
      getExtraHeaderActions,
    };
    const { rerender } = render(<SchemaTable {...props} readOnly />);
    expect(screen.queryByRole('button', { name: 'Change field type' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit column permissions' })).toBeNull();
    expect(onSchemaTypeChange).not.toHaveBeenCalled();
    expect(getExtraHeaderActions).not.toHaveBeenCalled();

    rerender(<SchemaTable {...props} readOnly={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Change field type' }));
    expect(onChange).toHaveBeenCalledWith(['STRING']);
    expect(screen.getByRole('button', { name: 'Edit column permissions' })).toBeTruthy();
  });
});
