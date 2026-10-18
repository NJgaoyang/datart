import { vi } from 'vitest';
import { request2 } from 'utils/request';
import {
  cancelPendingWidgetFetches,
  enqueueWidgetFetch,
  WidgetFetchCancelledError,
} from '../widgetDataBatcher';

vi.mock('utils/request', () => ({ request2: vi.fn() }));
const request = vi.mocked(request2);

describe('dashboard batch query request lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    request.mockReset();
  });
  afterEach(async () => {
    cancelPendingWidgetFetches('board-one');
    cancelPendingWidgetFetches('board-two');
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('deduplicates same widget + identical query parameters while pending', async () => {
    request.mockResolvedValue({ data: { rows: [['ok']] } } as any);
    const first = enqueueWidgetFetch('board-one', 'widget-1', { vizId: 'view-A', filters: [1] });
    const duplicate = enqueueWidgetFetch('board-one', 'widget-1', { vizId: 'view-A', filters: [1] });
    expect(duplicate).toBe(first);
    await vi.advanceTimersByTimeAsync(151);
    expect(await first).toEqual({ rows: [['ok']] });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('keeps requests for distinct widgets isolated even when their data query matches', async () => {
    request.mockResolvedValue({ data: { 'widget-1': { rows: [1] }, 'widget-2': { rows: [2] } } } as any);
    const a = enqueueWidgetFetch('board-one', 'widget-1', { vizId: 'view-A' });
    const b = enqueueWidgetFetch('board-one', 'widget-2', { vizId: 'view-A' });
    expect(a).not.toBe(b);
    await vi.advanceTimersByTimeAsync(151);
    expect(await a).toEqual({ rows: [1] });
    expect(await b).toEqual({ rows: [2] });
    expect(request).toHaveBeenCalledTimes(1);
    expect((request.mock.calls[0][0] as any).url).toBe('data-provider/execute/batch');
  });

  it('keeps the newest filter request and prevents a stale pending result', async () => {
    request.mockResolvedValue({ data: { rows: ['latest'] } } as any);
    const stale = enqueueWidgetFetch('board-one', 'widget-1', { date: '2026-10-16' });
    const rejected = expect(stale).rejects.toBeInstanceOf(WidgetFetchCancelledError);
    const latest = enqueueWidgetFetch('board-one', 'widget-1', { date: '2026-10-17' });
    await rejected;
    await vi.advanceTimersByTimeAsync(151);
    expect(await latest).toEqual({ rows: ['latest'] });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('ignores slow stale responses after the same widget gets newer filters', async () => {
    const completions: Array<(value: any) => void> = [];
    request.mockImplementation((config: any) => {
      if (config.url?.includes('/cancel/')) return Promise.resolve({ data: {} }) as any;
      return new Promise(resolve => completions.push(resolve)) as any;
    });
    const stale = enqueueWidgetFetch('board-one', 'widget-1', { date: '2026-10-16' });
    const rejected = expect(stale).rejects.toBeInstanceOf(WidgetFetchCancelledError);
    await vi.advanceTimersByTimeAsync(151);
    const latest = enqueueWidgetFetch('board-one', 'widget-1', { date: '2026-10-17' });
    await rejected;
    completions[0]({ data: { rows: ['old'] } });
    await vi.advanceTimersByTimeAsync(151);
    completions[1]({ data: { rows: ['new'] } });
    expect(await latest).toEqual({ rows: ['new'] });
    expect(request.mock.calls.filter(([config]) => (config as any).url === 'data-provider/execute')).toHaveLength(2);
  });

  it('cancelled pending queries cannot be reused by a later identical refresh', async () => {
    request.mockResolvedValue({ data: { rows: ['new'] } } as any);
    const stale = enqueueWidgetFetch('board-one', 'widget-1', { vizId: 'view-A' });
    const rejected = expect(stale).rejects.toBeInstanceOf(WidgetFetchCancelledError);
    cancelPendingWidgetFetches('board-one');
    await rejected;
    const fresh = enqueueWidgetFetch('board-one', 'widget-1', { vizId: 'view-A' });
    expect(fresh).not.toBe(stale);
    await vi.advanceTimersByTimeAsync(151);
    expect(await fresh).toEqual({ rows: ['new'] });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('cancelled in-flight results never resolve and do not poison new refreshes', async () => {
    let complete!: (value: unknown) => void;
    request.mockImplementation((config: any) => {
      if (config.url?.includes('/cancel/')) return Promise.resolve({ data: {} }) as any;
      return new Promise(resolve => { complete = resolve; }) as any;
    });
    const stale = enqueueWidgetFetch('board-one', 'widget-1', { vizId: 'view-A' });
    const rejected = expect(stale).rejects.toBeInstanceOf(WidgetFetchCancelledError);
    await vi.advanceTimersByTimeAsync(151);
    cancelPendingWidgetFetches('board-one');
    await rejected;
    const fresh = enqueueWidgetFetch('board-one', 'widget-1', { vizId: 'view-A' });
    expect(fresh).not.toBe(stale);
    complete({ data: { rows: ['old'] } });
    await vi.advanceTimersByTimeAsync(151);
    complete({ data: { rows: ['new'] } });
    expect(await fresh).toEqual({ rows: ['new'] });
  });
});