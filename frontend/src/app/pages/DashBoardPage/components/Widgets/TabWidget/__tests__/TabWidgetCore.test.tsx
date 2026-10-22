import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WidgetActionContext } from 'app/pages/DashBoardPage/components/ActionProvider/WidgetActionProvider';
import { BoardContext } from 'app/pages/DashBoardPage/components/BoardProvider/BoardProvider';
import { WidgetInfoContext } from 'app/pages/DashBoardPage/components/WidgetProvider/WidgetInfoProvider';
import { WidgetContext } from 'app/pages/DashBoardPage/components/WidgetProvider/WidgetProvider';
import { Provider } from 'react-redux';
import { vi } from 'vitest';
import { TabWidgetCore } from '../TabWidgetCore';

vi.mock('../tabConfig', () => ({
  default: {
    toolkit: { getCustomConfig: () => ({ align: 'start', position: 'top' }) },
  },
}));
vi.mock(
  'app/pages/DashBoardPage/components/WidgetProvider/WidgetWrapProvider',
  () => ({
    WidgetWrapProvider: ({
      id,
      children,
    }: {
      id: string;
      children: React.ReactNode;
    }) => <div data-testid={id}>{children}</div>,
  }),
);
vi.mock('app/pages/DashBoardPage/components/WidgetMapper/WidgetMapper', () => ({
  WidgetMapper: () => <span data-testid="chart-inner">图表内容已挂载</span>,
}));
vi.mock(
  'app/pages/DashBoardPage/components/WidgetComponents/DropHolder',
  () => ({
    DropHolder: () => <span>Drop target</span>,
  }),
);
vi.mock('app/utils/dispatchResize', () => ({ dispatchResize: vi.fn() }));

const store = configureStore({ reducer: (state = {}) => state });
const makeWidget = (entries: Array<[number, string, string]>) => ({
  id: 'tab-container',
  config: {
    customConfig: { props: [] },
    content: {
      itemMap: Object.fromEntries(
        entries.map(([index, name, id]) => [
          'tab-' + index,
          { index, name, tabId: 'tab-' + index, childWidgetId: id },
        ]),
      ),
    },
  },
});

function dashboard(
  widget = makeWidget([
    [11, '在租用户统计', 'chart-one'],
    [12, '用户日报数据', 'chart-two'],
  ]),
) {
  return (
    <Provider store={store}>
      <BoardContext.Provider
        value={{ boardType: 'auto', editing: false, boardId: 'board-1' } as any}
      >
        <WidgetContext.Provider value={widget as any}>
          <WidgetInfoContext.Provider value={{ editing: false } as any}>
            <WidgetActionContext.Provider
              value={{ onEditSelectWidget: vi.fn() } as any}
            >
              <div style={{ width: 650, height: 350 }}>
                <TabWidgetCore />
              </div>
            </WidgetActionContext.Provider>
          </WidgetInfoContext.Provider>
        </WidgetContext.Provider>
      </BoardContext.Provider>
    </Provider>
  );
}

describe('Ant Design 6 dashboard tab contents', () => {
  it('propagates height through the real AntD 6 body and panel elements', () => {
    const { container } = render(dashboard());
    const holder = container.querySelector<HTMLElement>(
      '.ant-tabs-body-holder',
    )!;
    const body = container.querySelector<HTMLElement>('.ant-tabs-body')!;
    const panel = screen.getByRole('tabpanel');
    expect(holder).not.toBeNull();
    expect(body).not.toBeNull();
    expect(getComputedStyle(holder).display).toBe('flex');
    expect(getComputedStyle(body).display).toBe('flex');
    expect(getComputedStyle(body).height).toBe('100%');
    expect(getComputedStyle(panel).display).toBe('flex');
    expect(getComputedStyle(panel).flexDirection).toBe('column');
    expect(getComputedStyle(panel).height).toBe('100%');
  });

  it('mounts the chart in the first tab in read mode', async () => {
    render(dashboard());
    expect(
      screen
        .getByRole('tab', { name: '在租用户统计' })
        .getAttribute('aria-selected'),
    ).toBe('true');
    await waitFor(() => expect(screen.getByTestId('chart-one')).not.toBeNull());
    expect(screen.getByTestId('chart-inner').textContent).toContain('图表内容');
  });

  it('mounts the selected nested chart and removes the old pane', async () => {
    render(dashboard());
    fireEvent.click(screen.getByRole('tab', { name: '用户日报数据' }));
    await waitFor(() => {
      expect(screen.getByTestId('chart-two')).not.toBeNull();
      expect(screen.queryByTestId('chart-one')).toBeNull();
    });
  });

  it('recovers selection when a saved tab is replaced with a new index', async () => {
    const { rerender } = render(dashboard());
    rerender(dashboard(makeWidget([[19, '更新后的图表', 'chart-updated']])));
    await waitFor(() =>
      expect(screen.getByTestId('chart-updated')).not.toBeNull(),
    );
  });
});
