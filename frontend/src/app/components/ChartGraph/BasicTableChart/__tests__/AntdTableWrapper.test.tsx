import { render } from '@testing-library/react';
import { vi } from 'vitest';
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

  it('does not shrink a fixed header in the mobile flex layout', () => {
    const tableProps = {
      dataSource: [{ key: '1', value: 'data' }],
      columns: [{ key: 'value', dataIndex: 'value', title: 'column' }],
      scroll: { x: 200, y: 180 },
    } as any;
    const { container } = render(
      <div className="datart-mobile-board" style={{ height: 300 }}>
        <AntdTableWrapper {...tableProps} />
      </div>,
    );
    const header = container.querySelector<HTMLElement>('.ant-table-header');

    expect(header).not.toBeNull();
    expect(window.getComputedStyle(header!).flexShrink).toBe('0');
    expect(window.getComputedStyle(header!).minHeight).toBe('40px');
  });
});
