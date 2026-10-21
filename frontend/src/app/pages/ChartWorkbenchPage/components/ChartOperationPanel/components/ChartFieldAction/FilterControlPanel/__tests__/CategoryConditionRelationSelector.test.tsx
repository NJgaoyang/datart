import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import ChartFilterCondition from 'app/models/ChartFilterCondition';
import { FilterSqlOperator } from 'globalConstants';
import CategoryConditionRelationSelector from '../CategoryConditionRelationSelector';

vi.mock('app/hooks/useI18NPrefix', () => ({
  default: () => (key: string) => key,
}));

it('keeps grouped relation options selectable beside the condition input', async () => {
  const changed = vi.fn();
  const condition = new ChartFilterCondition();
  condition.operator = FilterSqlOperator.Contain;
  condition.value = 'city';
  render(
    <CategoryConditionRelationSelector
      condition={condition}
      onConditionChange={changed}
    />,
  );
  expect(screen.getByRole('textbox')).toHaveValue('city');
  fireEvent.mouseDown(screen.getByRole('combobox'));
  fireEvent.click(await screen.findByText(FilterSqlOperator.NotContain));
  await waitFor(() => expect(changed).toHaveBeenCalled());
  expect(changed.mock.calls[0][0].operator).toBe(FilterSqlOperator.NotContain);
  expect(changed.mock.calls[0][0].value).toBeNull();
  expect(screen.getByRole('textbox')).toHaveValue('');
});
