import { fireEvent, render, screen } from '@testing-library/react';
import { useContext } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { WidgetActionContext, WidgetActionProvider } from '../WidgetActionProvider';

const { dispatch } = vi.hoisted(() => ({ dispatch: vi.fn() }));
vi.mock('redux/hooks', () => ({ useAppDispatch: () => dispatch }));
vi.mock('app/pages/DashBoardPage/actions/widgetAction', () => ({
  refreshWidgetsByControllerAction: (_mode, widget) => ({ type: 'refresh', id: widget.id }),
}));

it('refreshes both controllers when they change in quick succession', () => {
  dispatch.mockClear();
  const Controls = () => {
    const { onRefreshWidgetsByController } = useContext(WidgetActionContext);
    return <button onClick={() => {
      onRefreshWidgetsByController({ id: 'date' } as any);
      onRefreshWidgetsByController({ id: 'city' } as any);
    }}>改变筛选</button>;
  };
  render(<MemoryRouter><WidgetActionProvider orgId="org" boardId="board" boardEditing={false} renderMode="read" boardType="auto"><Controls /></WidgetActionProvider></MemoryRouter>);
  fireEvent.click(screen.getByText('改变筛选'));
  expect(dispatch.mock.calls.map(([action]) => action.id)).toEqual(['date', 'city']);
});
