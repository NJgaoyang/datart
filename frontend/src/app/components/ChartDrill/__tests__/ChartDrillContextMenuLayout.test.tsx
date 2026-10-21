import { render } from '@testing-library/react';
import ChartDrillContextMenu from '../ChartDrillContextMenu';
import { vi } from 'vitest';

vi.mock('app/hooks/useI18NPrefix', () => ({ default: () => (key: string) => key }));
vi.mock('app/components/Compat/LegacyDropdown', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('dashboard chart height inside AntD tab or group', () => {
  it('propagates flex dimensions through drill menu into the chart subtree', () => {
    const { container } = render(
      <div style={{ display: 'flex', flexDirection: 'column', height: 400 }}>
        <ChartDrillContextMenu>
          <div data-testid="chart-frame">chart content</div>
        </ChartDrillContextMenu>
      </div>,
    );
    const outer = container.querySelector<HTMLElement>('.chart-drill-menu-container');
    const inner = container.querySelector<HTMLElement>('.chart-drill-content');
    expect(outer).not.toBeNull();
    expect(inner).not.toBeNull();
    const outerStyle = getComputedStyle(outer!);
    const innerStyle = getComputedStyle(inner!);
    expect(outerStyle.height).toBe('100%');
    expect(outerStyle.display).toBe('flex');
    expect(parseFloat(outerStyle.minHeight)).toBe(0);
    expect(innerStyle.height).toBe('100%');
    expect(innerStyle.display).toBe('flex');
    expect(inner!.querySelector('[data-testid="chart-frame"]')).not.toBeNull();
  });
});
