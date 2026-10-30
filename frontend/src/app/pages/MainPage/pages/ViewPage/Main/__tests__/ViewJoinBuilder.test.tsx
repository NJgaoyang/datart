import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, it, vi } from 'vitest';
import { ViewJoinBuilder } from '../ViewJoinBuilder';

const mocks = vi.hoisted(() => ({ request: vi.fn(), dispatch: vi.fn() }));

vi.mock('utils/request', () => ({ request2: mocks.request }));
vi.mock('redux/hooks', () => ({ useAppDispatch: () => mocks.dispatch }));
vi.mock('react-redux', () => ({ useSelector: selector => selector({}) }));
vi.mock('app/hooks/useI18NPrefix', () => ({
  default: () => (key: string, values?: { index?: number }) =>
    values?.index ? `${key} ${values.index}` : key,
}));
vi.mock('app/pages/MainPage/pages/ViewPage/slice/selectors', () => ({
  selectCurrentEditingViewAttr: () => 'new-view',
  selectViews: () => [
    { id: 'orders', name: 'Orders', sourceId: 'source-1' },
    { id: 'refunds', name: 'Refunds', sourceId: 'source-1' },
  ],
}));
vi.mock('app/pages/MainPage/pages/ViewPage/slice', () => ({
  viewActions: { changeCurrentEditingView: payload => ({ type: 'change', payload }) },
}));
vi.mock('app/pages/MainPage/pages/ViewPage/slice/thunks', () => ({
  runSql: payload => ({ type: 'run', payload }),
  saveView: payload => ({ type: 'save', payload }),
}));
vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return {
    ...actual,
    // Keep the real Form event flow while avoiding portal/virtual-select details.
    Select: ({ id, value, options, onChange, disabled }) => (
      <select id={id} value={value || ''} disabled={disabled} onChange={event => onChange?.(event.target.value)}>
        <option value="" />
        {(options || []).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    ),
    Modal: ({ open, children, footer }) => open ? <div role="dialog">{children}{footer}</div> : null,
  };
});

function compose(joinType: string) {
  return { sourceId: 'source-1', script: `SELECT '${joinType}'`, config: '{}' };
}

async function chooseJoin() {
  fireEvent.change(screen.getByLabelText('leftView'), { target: { value: 'orders' } });
  fireEvent.change(screen.getByLabelText('rightView'), { target: { value: 'refunds' } });
  await waitFor(() => expect(screen.getByLabelText('leftColumn').querySelector('option[value="amount"]')).toBeTruthy());
  await waitFor(() => expect(screen.getByLabelText('rightColumn').querySelector('option[value="amount"]')).toBeTruthy());
  fireEvent.change(screen.getByLabelText('leftColumn'), { target: { value: 'amount' } });
  fireEvent.change(screen.getByLabelText('rightColumn'), { target: { value: 'amount' } });
}

describe('generated join query freshness', () => {
  beforeEach(() => {
    mocks.request.mockReset();
    mocks.dispatch.mockReset();
    mocks.request.mockImplementation(async input => {
      if (typeof input === 'string') {
        return { data: {
          id: input.split('/').pop(),
          sourceId: 'source-1',
          model: { columns: { amount: { name: ['amount'], type: 'NUMERIC' } } },
        } };
      }
      return { data: compose(input.data.joinType) };
    });
  });

  it('requires regeneration after conditions change and only applies the new query', async () => {
    render(<ViewJoinBuilder />);
    await chooseJoin();
    fireEvent.click(screen.getByRole('button', { name: 'generate' }));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'back' }));

    fireEvent.change(screen.getByLabelText('joinType'), { target: { value: 'LEFT' } });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: 'save' })).toBeNull();
    expect(screen.getByText('regenerateRequired')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'generate' }));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'openEditor' }));
    expect(mocks.dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'change', payload: expect.objectContaining({ script: "SELECT 'LEFT'" }),
    }));
  });

  it('ignores an in-flight result if the join changed while generating', async () => {
    let resolvePending!: (value: { data: ReturnType<typeof compose> }) => void;
    const normalRequest = mocks.request.getMockImplementation()!;
    mocks.request.mockImplementation(input => typeof input === 'string'
      ? normalRequest(input)
      : new Promise(resolve => { resolvePending = resolve; }));

    render(<ViewJoinBuilder />);
    await chooseJoin();
    fireEvent.click(screen.getByRole('button', { name: 'generate' }));
    await waitFor(() => expect(resolvePending).toBeDefined());
    fireEvent.change(screen.getByLabelText('joinType'), { target: { value: 'LEFT' } });
    await act(async () => { resolvePending({ data: compose('INNER') }); });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: 'save' })).toBeNull();
    expect(screen.getByText('regenerateRequired')).toBeTruthy();
  });

  it('labels both sides of each condition and preserves the remaining condition after removal', async () => {
    render(<ViewJoinBuilder />);
    expect(screen.getByLabelText('leftColumn')).toBeDisabled();
    expect(screen.getByLabelText('rightColumn')).toBeDisabled();
    await chooseJoin();
    expect(screen.getByLabelText('leftColumn')).not.toBeDisabled();
    expect(screen.getByLabelText('rightColumn')).not.toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'addCondition' }));
    const second = screen.getByRole('group', { name: 'conditionNumber 2' });
    expect(within(second).getByLabelText('leftColumn')).toBeTruthy();
    expect(within(second).getByLabelText('rightColumn')).toBeTruthy();
    fireEvent.click(within(second).getByRole('button', { name: 'removeCondition 2' }));
    expect(screen.getByRole('button', { name: 'addCondition' })).toHaveFocus();
    expect(screen.queryByRole('group', { name: 'conditionNumber 2' })).toBeNull();
    expect(screen.getByLabelText('leftColumn')).toHaveValue('amount');
    expect(screen.getByLabelText('rightColumn')).toHaveValue('amount');

    fireEvent.click(screen.getByRole('button', { name: 'generate' }));
    await screen.findByRole('dialog');
    expect(mocks.request).toHaveBeenCalledWith({
      url: '/views/compose',
      method: 'POST',
      data: {
        leftViewId: 'orders',
        rightViewId: 'refunds',
        joinType: 'INNER',
        conditions: [{ leftColumn: 'amount', rightColumn: 'amount' }],
      },
    });
    const preview = screen.getByRole('textbox', { name: 'generatedSql' });
    expect(preview).toHaveAttribute('readonly');
    expect(preview).toHaveValue("SELECT 'INNER'");
  });
});
