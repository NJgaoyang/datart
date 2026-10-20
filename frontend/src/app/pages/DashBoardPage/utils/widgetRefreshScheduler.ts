/**
 * Shared dashboard refresh scheduler.
 *
 * A single one-second ticker replaces one setInterval per widget. Refresh
 * requests are spread over ticks (at most eight each second) to avoid
 * triggering a dashboard-wide query burst when the page becomes visible.
 * Existing per-widget refresh intervals and viewport checks remain intact.
 */
type RefreshTask = {
  id: number;
  period: number;
  nextAt: number;
  run: () => void;
};

const tasks = new Map<number, RefreshTask>();
let ticker: ReturnType<typeof setInterval> | undefined;
let nextId = 1;
const TICK_MS = 1000;
const MAX_REFRESH_PER_TICK = 8;

const tick = () => {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  const now = Date.now();
  const due = Array.from(tasks.values())
    .filter(item => item.nextAt <= now)
    .sort((a, b) => a.nextAt - b.nextAt || a.id - b.id)
    .slice(0, MAX_REFRESH_PER_TICK);

  for (const task of due) {
    // A widget may be unmounted as an earlier callback runs.
    if (!tasks.has(task.id)) continue;
    task.nextAt = now + task.period;
    try {
      task.run();
    } catch (error) {
      // An error in one widget must not stop the ticker for others.
      console.error('Dashboard widget refresh failed', error);
    }
  }
};

export const scheduleWidgetRefresh = (seconds: number, run: () => void): (() => void) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return () => undefined;

  const id = nextId++;
  const period = Math.max(TICK_MS, Math.round(seconds * 1000));
  tasks.set(id, { id, period, nextAt: Date.now() + period, run });
  if (!ticker) ticker = setInterval(tick, TICK_MS);
  return () => {
    tasks.delete(id);
    if (!tasks.size && ticker) {
      clearInterval(ticker);
      ticker = undefined;
    }
  };
};
