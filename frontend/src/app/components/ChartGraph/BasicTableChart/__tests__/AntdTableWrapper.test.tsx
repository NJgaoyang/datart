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

  it('preserves content-sized columns instead of stretching to the widget width', () => {
    const tableProps = {
      dataSource: [{ key: '1', city: '南京市', orders: 2043 }],
      columns: [
        { key: 'city', dataIndex: 'city', title: '城市', width: 88 },
        { key: 'orders', dataIndex: 'orders', title: '48V订单数', width: 110 },
      ],
      scroll: { x: 198, y: 180 },
    } as any;
    const { container } = render(<AntdTableWrapper {...tableProps} />);
    const headerTable = container.querySelector<HTMLElement>('.ant-table-header > table');
    const bodyTable = container.querySelector<HTMLElement>('.ant-table-body > table');

    expect(headerTable).not.toBeNull();
    expect(bodyTable).not.toBeNull();
    // JSDOM reports an inline min-width even if !important stylesheet
    // declarations override it in browsers. Verify the actual CSS rule.
    const tableRules = Array.from(document.styleSheets).flatMap(sheet =>
      Array.from(sheet.cssRules || []),
    );
    expect(
      tableRules.some(rule =>
        rule.cssText.includes('.ant-table-header>table') &&
        rule.cssText.includes('min-width: 0 !important'),
      ),
    ).toBe(true);
    expect(headerTable!.style.width).toBe('198px');
    expect(bodyTable!.style.width).toBe('198px');
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
