import { locateAutoWidget } from '../locateWidget';
import { vi } from 'vitest';

describe('dashboard layer panel locate action', () => {
  it('scrolls only the requested grid widget without affecting others', () => {
    const root = document.createElement('div');
    const chart = document.createElement('div');
    chart.setAttribute('data-dashboard-widget-id', 'chart-1');
    chart.tabIndex = -1;
    chart.scrollIntoView = vi.fn();
    const other = document.createElement('div');
    other.setAttribute('data-dashboard-widget-id', 'chart-2');
    other.scrollIntoView = vi.fn();
    root.append(chart, other);
    document.body.appendChild(root);
    expect(locateAutoWidget('chart-1', root)).toBe(true);
    expect(chart.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth', block: 'center', inline: 'center',
    });
    expect(other.scrollIntoView).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(chart);
    root.remove();
  });

  it('never scrolls a different widget when the selected item is unavailable', () => {
    const root = document.createElement('div');
    const child = document.createElement('div');
    child.setAttribute('data-dashboard-widget-id', 'not-the-target');
    child.scrollIntoView = vi.fn();
    root.appendChild(child);
    expect(locateAutoWidget('unknown', root)).toBe(false);
    expect(child.scrollIntoView).not.toHaveBeenCalled();
  });
});
