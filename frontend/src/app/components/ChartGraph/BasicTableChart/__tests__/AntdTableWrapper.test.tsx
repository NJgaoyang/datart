import { render } from '@testing-library/react';
import { vi } from 'vitest';
import AntdTableWrapper, { getExplicitTableWidth } from '../AntdTableWrapper';

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

  it('sums content width for normal, grouped, and manually resized columns', () => {
    expect(
      getExplicitTableWidth([
        { key: 'city', width: 88 },
        { key: 'group', children: [{ width: 110 }, { width: '124px' }] },
      ] as any),
    ).toBe(322);
    expect(getExplicitTableWidth([{ width: 88 }, { width: '' }])).toBeUndefined();
    expect(getExplicitTableWidth([{ width: 88 }, { width: '25%' }])).toBeUndefined();
    expect(getExplicitTableWidth([{ width: 88 }, { width: 0 }])).toBeUndefined();
    expect(getExplicitTableWidth([])).toBeUndefined();
  });

  it('uses content width as a minimum and fills a wider widget', () => {
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
    expect(
      tableRules.some(rule =>
        rule.cssText.includes('.ant-table-body>table') &&
        rule.cssText.includes('width: max(198px, 100%) !important'),
      ),
    ).toBe(true);
  });

  it('keeps summary totals inside the horizontal scroller, above its scrollbar', () => {
    const columns = [
      { key: 'city', dataIndex: 'city', title: '城市', width: 180 },
      { key: 'orders', dataIndex: 'orders', title: '总订单数', width: 180 },
      { key: 'income', dataIndex: 'income', title: '租金收入', width: 180 },
    ];
    const { container } = render(
      <AntdTableWrapper
        dataSource={[{ id: 1, city: '苏州市', orders: 3, income: 100 }] as any}
        columns={columns as any}
        scroll={{ x: 540, y: 120 }}
        summaryFn={() => ({ summarys: ['汇总', '3', '100'] } as any)}
      />,
    );

    const body = container.querySelector('.ant-table-body');
    const footer = body?.querySelector('table > tfoot.ant-table-summary');
    expect(footer).not.toBeNull();
    expect(footer?.textContent).toContain('汇总');
    expect(body?.querySelector('table > tbody')).not.toBeNull();
    // A separately fixed summary would appear AFTER the scrollable body and
    // strand the horizontal scrollbar between data and the total row.
    expect(
      container.querySelector('.ant-table-container > .ant-table-summary'),
    ).toBeNull();
    expect(
      Array.from(document.styleSheets).flatMap(sheet =>
        Array.from(sheet.cssRules || []),
      ).some(rule =>
        rule.cssText.includes('tfoot.ant-table-summary') &&
        rule.cssText.includes('position: sticky'),
      ),
    ).toBe(true);
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
