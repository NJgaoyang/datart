import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scheduleWidgetRefresh } from '../widgetRefreshScheduler';

describe('shared dashboard widget refresh scheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses one ticker and preserves each widget refresh interval', () => {
    const a = vi.fn();
    const b = vi.fn();
    const spy = vi.spyOn(globalThis, 'setInterval');
    const stopA = scheduleWidgetRefresh(2, a);
    const stopB = scheduleWidgetRefresh(3, b);
    expect(spy).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2000);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(b).toHaveBeenCalledTimes(1);
    stopA();
    stopB();
    spy.mockRestore();
  });

  it('limits simultaneous requests and releases callbacks after unregister', () => {
    const calls = Array.from({ length: 20 }, () => vi.fn());
    const dispose = calls.map(call => scheduleWidgetRefresh(1, call));
    vi.advanceTimersByTime(1000);
    expect(calls.filter(call => call.mock.calls.length > 0)).toHaveLength(8);
    vi.advanceTimersByTime(1000);
    expect(calls.filter(call => call.mock.calls.length > 0)).toHaveLength(16);
    dispose.forEach(fn => fn());
    calls.forEach(call => call.mockClear());
    vi.advanceTimersByTime(5000);
    expect(calls.every(call => call.mock.calls.length === 0)).toBe(true);
  });
});
