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

  it('does not starve the first query under a continuous stream of new widgets', async () => {
    request.mockImplementation(async (config: any) => ({
      data: config.url === 'data-provider/execute/batch'
        ? Object.fromEntries(config.data.map((x: any) => [x.requestId, { rows: [x.requestId] }]))
        : { rows: ['ok'] },
    }) as any);
    const first = enqueueWidgetFetch('board-one', 'first', { vizId: 'test' });
    // New widgets arrive every 100ms, faster than the 150ms flush interval.
    await vi.advanceTimersByTimeAsync(100);
    const second = enqueueWidgetFetch('board-one', 'second', { vizId: 'test' });
    await vi.advanceTimersByTimeAsync(51);
    expect(request).toHaveBeenCalledTimes(1);
    expect(await first).toEqual({ rows: ['first'] });
    expect(await second).toEqual({ rows: ['second'] });
  });

  it('limits simultaneous HTTP batch work and sends only bounded payloads', async () => {
    let active = 0;
    let maximumActive = 0;
    const callbacks: Array<() => void> = [];
    const requests: Array<{ url: string; count: number }> = [];
    request.mockImplementation((config: any) => {
      if (config.url?.includes('/cancel/')) return Promise.resolve({ data: {} }) as any;
      if (config.url !== 'data-provider/execute/batch') throw Error('Expected batching');
      const records = config.data as Array<{ requestId: string }>;
      requests.push({ url: config.url, count: records.length });
      active++;
      maximumActive = Math.max(active, maximumActive);
      return new Promise(resolve => callbacks.push(() => {
        active--;
        resolve({
          data: Object.fromEntries(records.map(entry => [entry.requestId, { rows: [entry.requestId] }])),
        });
      })) as any;
    });
    const all = Array.from({ length: 100 }, (_, i) =>
      enqueueWidgetFetch('board-one', `widget-${i}`, { vizId: 'view-A', filter: i }),
    );
    await vi.advanceTimersByTimeAsync(151);
    expect(requests.map(item => item.count)).toEqual([40, 40]);
    callbacks.shift()?.();
    // Let the prior chunk's await/finally finish and admit the queued one.
    await vi.advanceTimersByTimeAsync(1);
    expect(requests.map(item => item.count)).toEqual([40, 40, 20]);
    callbacks.shift()?.();
    callbacks.shift()?.();
    expect((await Promise.all(all)).length).toBe(100);
    expect(maximumActive).toBeLessThanOrEqual(2);
  });

  it.each([100, 500, 1000])('settles %i synthetic widget queries without oversized batches', async count => {
    const sizes: number[] = [];
    request.mockImplementation(async (config: any) => {
      if (config.url !== 'data-provider/execute/batch') throw Error('Expected batch query');
      const records = config.data as Array<{ requestId: string }>;
      sizes.push(records.length);
      return {
        data: Object.fromEntries(records.map(entry =>
          [entry.requestId, { rows: [entry.requestId] }],
        )),
      } as any;
    });
    const requests = Array.from({ length: count }, (_, i) =>
      enqueueWidgetFetch('board-one', `widget-${i}`, { vizId: 'view-A', filter: i }),
    );
    await vi.advanceTimersByTimeAsync(151);
    const results = await Promise.all(requests);
    expect(results).toHaveLength(count);
    expect(results[0].rows[0]).toBe('widget-0');
    expect(results[count - 1].rows[0]).toBe(`widget-${count - 1}`);
    expect(sizes.every(size => size <= 40)).toBe(true);
    expect(sizes.reduce((sum, size) => sum + size, 0)).toBe(count);
    expect(sizes.length).toBe(Math.ceil(count / 40));
  });

  it('cancels a queued board without disturbing another board under backpressure', async () => {
    const callbacks: Array<() => void> = [];
    request.mockImplementation((config: any) => {
      const records = config.data as Array<{ requestId: string }>;
      return new Promise(resolve => callbacks.push(() => resolve({
        data: Object.fromEntries(records.map(entry =>
          [entry.requestId, { rows: [entry.requestId] }],
        )),
      }))) as any;
    });
    // Exactly two active batches and one queued batch.
    const promises = Array.from({ length: 85 }, (_, i) =>
      enqueueWidgetFetch(i < 80 ? 'board-two' : 'board-one',
        `widget-${i}`, { vizId: 'view-A' }),
    );
    const rejected = Promise.all(promises.slice(80).map(p =>
      expect(p).rejects.toBeInstanceOf(WidgetFetchCancelledError)));
    await vi.advanceTimersByTimeAsync(151);
    expect(callbacks).toHaveLength(2);
    cancelPendingWidgetFetches('board-one');
    await rejected;
    callbacks.shift()?.();
    callbacks.shift()?.();
    expect((await Promise.all(promises.slice(0, 80))).length).toBe(80);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('does not retry a failed single query and retains its structured permission code', async () => {
    request.mockResolvedValue({
      success: false, errCode: 403, message: 'sensitive query details', data: null,
    } as any);
    const result = enqueueWidgetFetch('board-one', 'widget-1', { vizId: 'view-A' });
    const rejected = expect(result).rejects.toMatchObject({
      name: 'Error', errCode: 403, message: '数据查询失败，请重试',
    });
    await vi.advanceTimersByTimeAsync(151);
    await rejected;
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('does not retry a failed batch', async () => {
    request.mockResolvedValue({ success: false, errCode: 500, data: null } as any);
    const a = enqueueWidgetFetch('board-one', 'widget-1', { vizId: 'view-A' });
    const b = enqueueWidgetFetch('board-one', 'widget-2', { vizId: 'view-B' });
    const rejected = Promise.all([expect(a).rejects.toThrow(), expect(b).rejects.toThrow()]);
    await vi.advanceTimersByTimeAsync(151);
    await rejected;
    expect(request).toHaveBeenCalledTimes(1);
  });

  it.each([404, 405, 501])('retries unsupported batch HTTP %i with bounded parallelism', async status => {
    let active = 0; let maximum = 0;
    request.mockImplementation(async (config: any) => {
      if (config.url === 'data-provider/execute/batch') throw { response: { status } };
      active++; maximum = Math.max(maximum, active);
      await Promise.resolve(); active--;
      return { data: { rows: [['ok']] } } as any;
    });
    const items = Array.from({ length: 5 }, (_, i) => enqueueWidgetFetch('board-one', `widget-${i}`, { vizId: 'view' }));
    await vi.advanceTimersByTimeAsync(151);
    await Promise.all(items);
    expect(maximum).toBeGreaterThan(1);
    expect(maximum).toBeLessThanOrEqual(4);
    expect(request).toHaveBeenCalledTimes(6);
  });

  it('recovers missing batch entries without unbounded fallback requests', async () => {
    let active = 0;
    let maximumActive = 0;
    request.mockImplementation(async (config: any) => {
      if (config.url === 'data-provider/execute/batch') {
        return { data: { known: { rows: [['ready']] } } } as any;
      }
      active++;
      maximumActive = Math.max(maximumActive, active);
      await Promise.resolve();
      active--;
      return { data: { rows: [['fallback']] } } as any;
    });
    const known = enqueueWidgetFetch('board-one', 'known', { vizId: 'view' });
    const missing = Array.from({ length: 12 }, (_, i) =>
      enqueueWidgetFetch('board-one', `missing-${i}`, { vizId: 'view', filter: i }),
    );
    await vi.advanceTimersByTimeAsync(151);
    expect(await known).toEqual({ rows: [['ready']] });
    expect(await Promise.all(missing)).toHaveLength(12);
    expect(maximumActive).toBeGreaterThan(1);
    expect(maximumActive).toBeLessThanOrEqual(4);
    expect(request).toHaveBeenCalledTimes(13);
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
  it('does not retry failed or forbidden batch entries', async () => {
    request.mockResolvedValue({ data: {
      good: { rows: [['healthy']] },
      failed: { error: 'QUERY_FAILED' },
      forbidden: { error: 'PERMISSION_DENIED' },
    } } as any);
    const good = enqueueWidgetFetch('board-one', 'good', { vizId: 'view-A' });
    const bad = enqueueWidgetFetch('board-one', 'failed', { vizId: 'view-B' });
    const forbidden = enqueueWidgetFetch('board-one', 'forbidden', { vizId: 'view-C' });
    const checks = Promise.all([expect(bad).rejects.toThrow(), expect(forbidden).rejects.toMatchObject({ errCode: 403 })]);
    await vi.advanceTimersByTimeAsync(151);
    expect(await good).toEqual({ rows: [['healthy']] });
    await checks;
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('recovers when an older backend response omits a batch widget key', async () => {
    request.mockImplementation(async (config: any) => {
      if (config.url === 'data-provider/execute/batch') {
        return { data: { known: { rows: [['present']] } } } as any;
      }
      return { data: { rows: [['retried']] } } as any;
    });
    const first = enqueueWidgetFetch('board-one', 'known', { vizId: 'view-A' });
    const second = enqueueWidgetFetch('board-one', 'missing', { vizId: 'view-B' });
    await vi.advanceTimersByTimeAsync(151);
    expect(await first).toEqual({ rows: [['present']] });
    expect(await second).toEqual({ rows: [['retried']] });
    expect(request).toHaveBeenCalledTimes(2);
  });

});