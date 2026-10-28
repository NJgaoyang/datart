import { unwrapWidgetQueryResponse } from 'app/utils/queryResponse';
/**
 * 仪表板 Widget 数据批量请求调度器
 *
 * 核心优化：将 N 次独立的 POST /data-provider/execute 合并为 1 次 POST /data-provider/execute/batch
 * 通过 150ms 防抖窗口收集并发 Widget 请求，大幅减少 HTTP 往返和浏览器并发排队
 */
import { request2 } from 'utils/request';

const preserveHttpError = (error: unknown): never => { throw error; };

interface BatchEntry {
  boardId: string;
  widgetId: string;
  queryId: string;
  requestParams: any;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  cacheKey?: string;
  promise?: Promise<any>;
  widgetKey?: string;
  cancelled?: boolean;
}

let pendingQueue: BatchEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const inFlight = new Map<string, BatchEntry>();
// Never send all 500/1000 widgets in one HTTP request or start an unbounded
// number of batch requests together. Keep admission queue separate from the
// actively executing chunks, so an old slow query cannot stall all pending
// widgets forever.
const MAX_BATCH_ENTRIES = 40;
const MAX_CONCURRENT_BATCHES = 2;
// Fall back to bounded parallel requests only when the batch API is unavailable
// or a response entry is missing. With 2 batches, at most 8 fallback HTTP calls
// can be active. Permission/business failures must never trigger retries.
const MAX_FALLBACK_CONCURRENT_PER_BATCH = 4;
let activeBatchCount = 0;

// Exact same widget + serialized query (including filters, sort, paging and
// source) shares one promise. Different widgets/sources NEVER share results.
const activeQueries = new Map<string, Promise<any>>();
const activeByWidget = new Map<string, BatchEntry>();

export class WidgetFetchCancelledError extends Error {
  constructor() {
    super('Widget fetch cancelled');
    this.name = 'WidgetFetchCancelledError';
  }
}

const forgetActiveQuery = (entry: BatchEntry) => {
  if (entry.cacheKey && activeQueries.get(entry.cacheKey) === entry.promise) {
    activeQueries.delete(entry.cacheKey);
  }
  if (entry.widgetKey && activeByWidget.get(entry.widgetKey) === entry) {
    activeByWidget.delete(entry.widgetKey);
  }
};

/** Do not allow an older query to overwrite the result after filters change. */
const cancelEntry = (entry: BatchEntry) => {
  if (entry.cancelled) return;
  entry.cancelled = true;
  pendingQueue = pendingQueue.filter(item => item !== entry);
  forgetActiveQuery(entry);
  entry.reject(new WidgetFetchCancelledError());
  if (inFlight.has(entry.queryId)) {
    void request2({
      method: 'POST',
      url: `data-provider/execute/cancel/${entry.queryId}`,
    }).catch(() => undefined);
  }
};


/** 防抖延迟(ms): 在此窗口内到达的请求会合并为一个批次 */
const BATCH_DEBOUNCE_MS = 150;

const createQueryId = () =>
  globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;

/**
 * 将单个 Widget 的数据请求加入批量队列
 * @returns Promise，在批量请求完成后 resolve 该 Widget 的数据
 */
export function enqueueWidgetFetch(
  boardId: string,
  widgetId: string,
  requestParams: any,
): Promise<any> {
  let key: string | undefined;
  try {
    key = JSON.stringify([boardId, widgetId, requestParams]);
  } catch {
    // A non-serializable query cannot be safely compared: send it normally.
  }
  const existing = key === undefined ? undefined : activeQueries.get(key);
  if (existing) return existing;

  // A widget can only have ONE effective query in flight. If a date/filter
  // changes during a slow query, discard the older response and stop it
  // server-side when possible, instead of confusing the batch response map
  // which indexes results by widgetId.
  const widgetKey = JSON.stringify([boardId, widgetId]);
  const previous = activeByWidget.get(widgetKey);
  if (previous) cancelEntry(previous);

  const entry: BatchEntry = {
    boardId,
    widgetId,
    queryId: createQueryId(),
    requestParams,
    cacheKey: key,
    widgetKey,
    resolve: () => undefined,
    reject: () => undefined,
  };
  const promise = new Promise<any>((resolve, reject) => {
    entry.resolve = resolve;
    entry.reject = reject;
  });
  entry.promise = promise;
  if (key !== undefined) activeQueries.set(key, promise);
  activeByWidget.set(widgetKey, entry);
  pendingQueue.push(entry);
  scheduleFlush();
  // Fulfillment or failure permits a new fetch next time. Do not delete a
  // newer replacement when an older cancelled request finishes late.
  void promise.then(
    () => forgetActiveQuery(entry),
    () => forgetActiveQuery(entry),
  );
  return promise;
}

function scheduleFlush(): void {
  // Do not reset this timer on each arrival: otherwise a steady stream
  // of filters (<150ms between events) can postpone *all* queries forever.
  if (flushTimer !== null || pendingQueue.length === 0 ||
      activeBatchCount >= MAX_CONCURRENT_BATCHES) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    drainPendingBatches();
  }, BATCH_DEBOUNCE_MS);
}

function drainPendingBatches(): void {
  while (
    activeBatchCount < MAX_CONCURRENT_BATCHES &&
    pendingQueue.length > 0
  ) {
    const batch = pendingQueue.splice(0, MAX_BATCH_ENTRIES);
    activeBatchCount++;
    void flushBatch(batch).finally(() => {
      activeBatchCount--;
      // Run queued chunks as a previous one finishes; no timer reset here.
      drainPendingBatches();
    });
  }
}

async function flushBatch(batch: BatchEntry[]): Promise<void> {
  if (!batch.length) return;

  batch.forEach(entry => inFlight.set(entry.queryId, entry));
  try {
    // 如果队列只有 1 个请求，退化到单请求模式（避免不必要的批量包装开销）
    if (batch.length === 1) {
      const entry = batch[0];
      const response = await request2<any>({
        method: 'POST',
        url: 'data-provider/execute',
        data: { ...entry.requestParams, queryId: entry.queryId },
      }, undefined, { onRejected: preserveHttpError });
      const data = unwrapWidgetQueryResponse(response);
      if (!entry.cancelled) {
        if (data?.error) {
          entry.reject(new Error(`Widget query failed: ${data.error}`));
        } else {
          entry.resolve(data);
        }
      }
      return;
    }

    // 批量请求模式
    const response = await request2<Record<string, any>>({
      method: 'POST',
      url: 'data-provider/execute/batch',
      data: batch.map(entry => ({
        requestId: entry.widgetId,
        queryId: entry.queryId,
        ...entry.requestParams,
      })),
    }, undefined, { onRejected: preserveHttpError });

    const resultMap: Record<string, any> = unwrapWidgetQueryResponse(response) || {};

    const missingEntries: BatchEntry[] = [];
    for (const entry of batch) {
      if (entry.cancelled) continue;
      const result = resultMap[entry.widgetId] ?? resultMap[entry.requestParams?.vizId || ''];
      if (result === undefined) {
        missingEntries.push(entry);
      } else if (result?.error === 'PERMISSION_DENIED') {
        entry.reject(Object.assign(new Error('无权访问图表数据'), { errCode: 403 }));
      } else if (result?.error) {
        entry.reject(new Error('图表数据查询失败'));
      } else {
        entry.resolve(result);
      }
    }
    await retryEntriesConcurrently(missingEntries);
  } catch (error) {
    const status = (error as any)?.response?.status ?? (error as any)?.status;
    if (batch.length > 1 && [404, 405, 501].includes(status)) {
      await retryEntriesConcurrently(batch);
    } else {
      batch.forEach(entry => { if (!entry.cancelled) entry.reject(error); });
    }
  } finally {
    batch.forEach(entry => inFlight.delete(entry.queryId));
  }
}

/**
 * Bound parallel fallback work without blocking unrelated widget results.
 * Cancellations are checked before admission and again inside retrySingle.
 */
async function retryEntriesConcurrently(entries: BatchEntry[]): Promise<void> {
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(MAX_FALLBACK_CONCURRENT_PER_BATCH, entries.length) },
    async () => {
      while (nextIndex < entries.length) {
        const entry = entries[nextIndex++];
        if (!entry.cancelled) await retrySingle(entry);
      }
    },
  );
  await Promise.all(workers);
}

async function retrySingle(entry: BatchEntry): Promise<void> {
  if (entry.cancelled) return;
  try {
    const response = await request2<any>({
      method: 'POST',
      url: 'data-provider/execute',
      data: { ...entry.requestParams, queryId: entry.queryId },
    }, undefined, { onRejected: preserveHttpError });
    if (entry.cancelled) return;
    const data = unwrapWidgetQueryResponse(response);
    if (data?.error) entry.reject(new Error('图表数据查询失败'));
    else entry.resolve(data);
  } catch (error) {
    if (!entry.cancelled) entry.reject(error);
  }
}

/** 只取消指定看板尚未发出的请求，避免卸载一个看板时影响其他看板。 */
export function cancelPendingWidgetFetches(boardId: string): void {
  const cancelled = pendingQueue.filter(entry => entry.boardId === boardId);
  pendingQueue = pendingQueue.filter(entry => entry.boardId !== boardId);

  cancelled.forEach(cancelEntry);
  Array.from(inFlight.values())
    .filter(entry => entry.boardId === boardId)
    .forEach(cancelEntry);

  if (pendingQueue.length === 0 && flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}