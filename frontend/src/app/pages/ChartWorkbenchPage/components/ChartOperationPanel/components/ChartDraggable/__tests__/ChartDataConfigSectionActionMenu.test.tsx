import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import {
  ChartDataSectionFieldActionType as Action,
  ChartDataViewFieldCategory,
  DataViewFieldType,
} from 'app/constants';
import ChartDataConfigSectionActionMenu from '../ChartDataConfigSectionActionMenu';

vi.mock('app/hooks/useI18NPrefix', () => ({
  default: () => (key: string) => key,
}));

it('keeps sorting and aggregation actions usable with native menu items', async () => {
  const changed = vi.fn();
  const field = {
    uid: 'amount',
    colName: 'amount',
    type: DataViewFieldType.NUMERIC,
    category: ChartDataViewFieldCategory.Field,
    aggregate: 'SUM',
  };
  render(
    <ChartDataConfigSectionActionMenu
      uid="amount"
      type={DataViewFieldType.NUMERIC}
      category={ChartDataViewFieldCategory.Field}
      ancestors={[0]}
      config={
        {
          rows: [field],
          actions: [Action.Sortable, Action.Aggregate],
          options: { [Action.Sortable]: { backendSort: false } },
        } as any
      }
      onOpenModal={vi.fn()}
      onConfigChanged={changed}
    />,
  );
  fireEvent.mouseEnter(screen.getByText(Action.Sortable));
  await waitFor(() => expect(screen.getByText('sort.asc')).toBeInTheDocument());
  fireEvent.click(screen.getByText('sort.asc'));
  expect(changed.mock.calls[0][1].rows[0].sort).toEqual({ type: 'ASC' });
  expect(changed.mock.calls[0][2]).toBe(false);
  fireEvent.mouseEnter(screen.getByText(Action.Aggregate));
  await waitFor(() => expect(screen.getByText('AVG')).toBeInTheDocument());
  fireEvent.click(screen.getByText('AVG'));
  expect(changed.mock.calls[1][1].rows[0].aggregate).toBe('AVG');
  expect(changed.mock.calls[1][2]).toBe(true);
  expect(field.aggregate).toBe('SUM');
});
