import { act, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import useResizeObserver from '../useResizeObserver';

const observers: Array<{
  notify: () => void;
  disconnect: ReturnType<typeof vi.fn>;
}> = [];
let dimensions = { width: 0, height: 0 };

function Preview({ shown = true, target = 'first' }) {
  const { ref, width, height } = useResizeObserver({ debounceMs: 100 });
  return (
    <>
      {shown && <div key={target} ref={ref} data-testid="target" />}
      <output>
        {width}x{height}
      </output>
    </>
  );
}

describe('native resize observation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    dimensions = { width: 0, height: 0 };
    observers.length = 0;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        disconnect = vi.fn();
        observe = vi.fn();
        constructor(notify: () => void) {
          observers.push({ notify, disconnect: this.disconnect });
        }
      },
    );
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      () => dimensions as DOMRect,
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('attaches when content arrives after the first render and tracks hidden panes becoming visible', () => {
    const { rerender, unmount } = render(<Preview shown={false} />);
    expect(observers).toHaveLength(0);
    rerender(<Preview />);
    expect(screen.getByRole('status')).toHaveTextContent('0x0');
    dimensions = { width: 620, height: 310 };
    act(() => {
      observers[0].notify();
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByRole('status')).toHaveTextContent('620x310');
    rerender(<Preview target="second" />);
    expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
    dimensions = { width: 800, height: 400 };
    act(() => {
      window.dispatchEvent(new Event('resize'));
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByRole('status')).toHaveTextContent('800x400');
    unmount();
    expect(observers[1].disconnect).toHaveBeenCalledTimes(1);
  });

  it('coalesces repeated notifications and cancels pending updates on unmount', () => {
    const { unmount } = render(<Preview />);
    dimensions = { width: 500, height: 200 };
    act(() => {
      observers[0].notify();
      vi.advanceTimersByTime(60);
    });
    expect(screen.getByRole('status')).toHaveTextContent('0x0');
    act(() => {
      observers[0].notify();
      vi.advanceTimersByTime(60);
    });
    expect(screen.getByRole('status')).toHaveTextContent('0x0');
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
