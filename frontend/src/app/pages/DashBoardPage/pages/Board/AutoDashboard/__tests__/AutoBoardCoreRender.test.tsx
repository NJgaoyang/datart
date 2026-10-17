import { render, screen } from '@testing-library/react';
import { Children, cloneElement, isValidElement } from 'react';
import { BoardContext } from 'app/pages/DashBoardPage/components/BoardProvider/BoardProvider';
import { BoardConfigValContext } from 'app/pages/DashBoardPage/components/BoardProvider/BoardConfigProvider';
import { AutoBoardCore } from '../AutoBoardCore';

// RGL v2 clones each DIRECT grid child to add DOM ref, className and
// positioning styles. This mock reproduces that public child contract.
vi.mock('app/pages/DashBoardPage/components/GridLayout/DashboardGridLayout', () => ({
  DashboardGridLayout: ({ children }: { children: React.ReactNode }) => (
    <section data-testid="grid">
      {Children.map(children, child =>
        isValidElement(child)
          ? cloneElement(child as React.ReactElement<any>, {
              className: 'react-grid-item',
              style: { transform: 'translate(24px, 36px)' },
              'data-testid': 'positioned-widget',
            })
          : null,
      )}
    </section>
  ),
}));

vi.mock('app/hooks/useGridWidgetHeight', () => ({
  useGridWidgetHeight: () => ({
    ref: () => {},
    widgetRowHeight: 8,
    colsKey: 'lg',
  }),
}));
vi.mock('app/pages/DashBoardPage/hooks/useBoardScroll', () => ({
  default: () => ({ gridWrapRef: { current: null }, thEmitScroll: () => {} }),
}));
vi.mock('app/pages/DashBoardPage/hooks/useLayoutMap', () => ({
  default: () => [{
    id: 'chart-1',
    config: { index: 0, pRect: { x: 0, y: 0, width: 36, height: 18 } },
  }],
}));
vi.mock('app/pages/DashBoardPage/hooks/useGridLayoutMap', () => ({
  default: () => ({
    lg: [{ i: 'chart-1', x: 0, y: 0, w: 36, h: 18 }],
  }),
}));
vi.mock('app/pages/DashBoardPage/components/WidgetProvider/WidgetWrapProvider', () => ({
  WidgetWrapProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../WidgetOfAuto', () => ({
  WidgetOfAuto: () => <span>Visible chart contents</span>,
}));
vi.mock('app/pages/DashBoardPage/components/WidgetComponents/StyledBackground', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('automatic dashboard read rendering with RGL v2', () => {
  it('forwards injected position styles onto a real grid child DOM node', () => {
    render(
      <BoardContext.Provider value={{ boardId: 'dashboard-1', editing: false } as any}>
        <BoardConfigValContext.Provider value={{
          background: { color: 'transparent' },
          allowOverlap: false,
          compactType: 'vertical',
          margin: [4, 4],
          padding: [8, 8],
          mMargin: [2, 2],
          mPadding: [4, 4],
        } as any}>
          <AutoBoardCore boardId="dashboard-1" />
        </BoardConfigValContext.Provider>
      </BoardContext.Provider>,
    );
    const widget = screen.getByTestId('positioned-widget');
    expect(widget.tagName).toBe('DIV');
    expect(widget.classList.contains('react-grid-item')).toBe(true);
    expect(widget.style.transform).toBe('translate(24px, 36px)');
    expect(screen.getByText('Visible chart contents')).toBeTruthy();
  });
});
