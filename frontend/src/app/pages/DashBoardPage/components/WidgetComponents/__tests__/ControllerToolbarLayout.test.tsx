import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { StyledWidgetToolBar } from '../StyledWidgetToolBar';
import { WidgetWrapper } from '../WidgetWrapper';

vi.mock('app/pages/DashBoardPage/utils/widget', () => ({
  getWidgetSomeStyle: () => ({}),
}));

describe('controller widget action hit areas', () => {
  it('keeps chart actions keyboard-focusable when mouse actions are hidden', async () => {
    const user = userEvent.setup();
    render(<StyledWidgetToolBar><button className="widget-tool-dropdown">More actions</button></StyledWidgetToolBar>);
    await user.tab();
    expect(screen.getByRole('button', { name: 'More actions' })).toBe(document.activeElement);
  });
  it('keeps the calendar input and widget actions in distinct flex siblings', () => {
    const openCalendar = vi.fn();
    const openActions = vi.fn();
    const { container } = render(
      <WidgetWrapper
        className="controller-widget"
        background={{} as any}
        padding={{} as any}
        border={{} as any}
      >
        <div className="controller-widget-content">
          <button onClick={openCalendar}>Choose date</button>
        </div>
        <StyledWidgetToolBar>
          <button className="widget-tool-dropdown" onClick={openActions}>
            Widget actions
          </button>
        </StyledWidgetToolBar>
      </WidgetWrapper>,
    );

    const wrapper = container.querySelector('.controller-widget');
    const inputArea = wrapper?.querySelector('.controller-widget-content');
    const toolbar = wrapper?.querySelector('.widget-action-toolbar');
    expect(inputArea?.parentElement).toBe(wrapper);
    expect(toolbar?.parentElement).toBe(wrapper);
    expect(toolbar).not.toBe(inputArea);

    fireEvent.click(screen.getByText('Choose date'));
    expect(openCalendar).toHaveBeenCalledTimes(1);
    expect(openActions).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Widget actions'));
    expect(openActions).toHaveBeenCalledTimes(1);
    expect(openCalendar).toHaveBeenCalledTimes(1);
  });
  it('keeps the auto filter content stretchable beside the action menu', () => {
    const { container } = render(
      <WidgetWrapper
        className="controller-widget dashboard-auto-filter"
        background={{} as any}
        padding={{ top: 20, right: 20, bottom: 20, left: 20 } as any}
        border={{} as any}
      >
        <div className="controller-widget-content">
          <div><input aria-label="Filter value" /></div>
        </div>
        <StyledWidgetToolBar>
          <button className="widget-tool-dropdown">Widget actions</button>
        </StyledWidgetToolBar>
      </WidgetWrapper>,
    );
    const outer = container.querySelector('.dashboard-auto-filter');
    const content = outer?.querySelector('.controller-widget-content');
    expect(outer).not.toBeNull();
    expect(content?.parentElement).toBe(outer);
    expect(outer?.querySelector('.widget-action-toolbar')?.parentElement).toBe(outer);
  });

});
