import { act, render, screen, waitFor } from '@testing-library/react';
import { useCacheWidthHeight } from '../useCacheWidthHeight';
import { vi } from 'vitest';

type ResizeCallback = (entries: ResizeObserverEntry[], observer: ResizeObserver) => void;
const mock = vi.hoisted(() => ({
  observer: null as null | { notify: () => void; disconnect: ReturnType<typeof vi.fn> },
}));
let activeSize = { width: 0, height: 0 };

class MockResizeObserver {
  private callback: ResizeCallback;
  disconnect = vi.fn();
  observe = vi.fn();
  unobserve = vi.fn();
  constructor(callback: ResizeCallback) {
    this.callback = callback;
    mock.observer = {
      notify: () => this.callback([], this as unknown as ResizeObserver),
      disconnect: this.disconnect,
    };
  }
}

function Preview() {
  const { cacheWhRef, cacheW, cacheH } = useCacheWidthHeight();
  return (
    <div ref={cacheWhRef} data-testid="size-target">
      <output data-testid="dimensions">{cacheW}x{cacheH}</output>
    </div>
  );
}

describe('native dashboard resize observation', () => {
  beforeEach(() => {
    activeSize = { width: 0, height: 0 };
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() =>
      ({
        x: 0, y: 0, top: 0, left: 0, bottom: activeSize.height,
        right: activeSize.width, width: activeSize.width, height: activeSize.height,
        toJSON: () => ({}),
      }) as DOMRect,
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    mock.observer = null;
  });

  it('measures immediately when an active chart pane mounts', async () => {
    activeSize = { width: 620, height: 310 };
    render(<Preview />);
    await waitFor(() => expect(screen.getByTestId('dimensions').textContent).toBe('620x310'));
  });

  it('recovers from initially hidden AntD Tab panes after they become visible', async () => {
    const { unmount } = render(<Preview />);
    expect(screen.getByTestId('dimensions').textContent).toBe('0x0');
    activeSize = { width: 710, height: 420 };
    await act(async () => {
      mock.observer?.notify();
    });
    await waitFor(() => expect(screen.getByTestId('dimensions').textContent).toBe('710x420'));
    unmount();
    expect(mock.observer?.disconnect).toHaveBeenCalledTimes(1);
  });

  it('updates chart dimensions when the dashboard grid is resized', async () => {
    activeSize = { width: 400, height: 190 };
    render(<Preview />);
    expect(screen.getByTestId('dimensions').textContent).toBe('400x190');
    activeSize = { width: 480, height: 250 };
    await act(async () => {
      window.dispatchEvent(new Event('resize'));
    });
    await waitFor(() => expect(screen.getByTestId('dimensions').textContent).toBe('480x250'));
  });
});
