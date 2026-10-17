import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { StyledWidgetToolBar } from '../StyledWidgetToolBar';
import { WidgetWrapper } from '../WidgetWrapper';

vi.mock('app/pages/DashBoardPage/utils/widget', () => ({
  getWidgetSomeStyle: () => ({}),
}));

describe('controller widget action hit areas', () => {
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
});
