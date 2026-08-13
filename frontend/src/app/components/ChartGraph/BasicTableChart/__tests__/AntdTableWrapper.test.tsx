import { render } from '@testing-library/react';
import AntdTableWrapper from '../AntdTableWrapper';

describe('AntdTableWrapper', () => {
  it('renders a stable widget id marker outside the Ant table DOM', () => {
    const getComputedStyle = window.getComputedStyle;
    vi.spyOn(window, 'getComputedStyle').mockImplementation(element =>
      getComputedStyle(element),
    );
    const { container } = render(
      <AntdTableWrapper widgetId="table-widget" dataSource={[]} columns={[]} />,
    );

    expect(
      container.querySelector('[data-datart-widget-id="table-widget"]'),
    ).not.toBeNull();
  });
});
