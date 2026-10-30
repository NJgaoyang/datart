import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewJoinBuilder } from '../ViewJoinBuilder';

const mocks = vi.hoisted(() => ({ request: vi.fn(), dispatch: vi.fn() }));

vi.mock('utils/request', () => ({ request2: mocks.request }));
vi.mock('redux/hooks', () => ({ useAppDispatch: () => mocks.dispatch }));
vi.mock('react-redux', () => ({ useSelector: selector => selector({}) }));
vi.mock('app/hooks/useI18NPrefix', () => ({ default: () => (key: string) => key }));
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
    Select: ({ id, value, options, onChange }) => (
      <select id={id} value={value || ''} onChange={event => onChange?.(event.target.value)}>
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
  await waitFor(() => expect(screen.getAllByRole('combobox')[3].querySelector('option[value="amount"]')).toBeTruthy());
  await waitFor(() => expect(screen.getAllByRole('combobox')[4].querySelector('option[value="amount"]')).toBeTruthy());
  fireEvent.change(screen.getAllByRole('combobox')[3], { target: { value: 'amount' } });
  fireEvent.change(screen.getAllByRole('combobox')[4], { target: { value: 'amount' } });
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
});
