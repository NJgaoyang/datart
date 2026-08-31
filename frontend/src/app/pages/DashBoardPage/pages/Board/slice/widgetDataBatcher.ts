/**
 * 仪表板 Widget 数据批量请求调度器
 *
 * 核心优化：将 N 次独立的 POST /data-provider/execute 合并为 1 次 POST /data-provider/execute/batch
 * 通过 150ms 防抖窗口收集并发 Widget 请求，大幅减少 HTTP 往返和浏览器并发排队
 */
import { request2 } from 'utils/request';

interface BatchEntry {
  boardId: string;
  widgetId: string;
  queryId: string;
  requestParams: any;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
}

let pendingQueue: BatchEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const inFlight = new Map<string, BatchEntry>();

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
  return new Promise((resolve, reject) => {
    pendingQueue.push({
      boardId,
      widgetId,
      queryId: createQueryId(),
      requestParams,
      resolve,
      reject,
    });
    scheduleFlush();
  });
}

function scheduleFlush(): void {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
  }
  flushTimer = setTimeout(flushBatch, BATCH_DEBOUNCE_MS);
}

async function flushBatch(): Promise<void> {
  const batch = pendingQueue;
  pendingQueue = [];
  flushTimer = null;

  if (batch.length === 0) return;

  batch.forEach(entry => inFlight.set(entry.queryId, entry));
  try {
    // 如果队列只有 1 个请求，退化到单请求模式（避免不必要的批量包装开销）
    if (batch.length === 1) {
      const entry = batch[0];
      const { data } = await request2<any>({
        method: 'POST',
        url: 'data-provider/execute',
        data: { ...entry.requestParams, queryId: entry.queryId },
      });
      entry.resolve(data);
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
    });

    const resultMap: Record<string, any> = response?.data || {};

    batch.forEach(entry => {
      const result = resultMap[entry.widgetId];
      if (result !== undefined) {
        entry.resolve(result);
      } else {
        // 尝试无 requestId 的降级查找
        const fallback =
          resultMap[
            Object.keys(resultMap).find(
              k => k === entry.requestParams?.vizId,
            ) || ''
          ];
        if (fallback !== undefined) {
          entry.resolve(fallback);
        } else {
          entry.reject(
            new Error(
              `Batch response missing data for widget ${entry.widgetId}`,
            ),
          );
        }
      }
    });
  } catch (error) {
    // A batch is rejected as a whole when any query fails. Retry entries
    // separately so one broken widget does not hide successful widget data,
    // while the failed widget still receives the real backend error.
    await Promise.all(
      batch.map(async entry => {
        try {
          const { data } = await request2<any>({
            method: 'POST',
            url: 'data-provider/execute',
            data: { ...entry.requestParams, queryId: entry.queryId },
          });
          entry.resolve(data);
        } catch (singleError) {
          entry.reject(singleError);
        }
      }),
    );
  } finally {
    batch.forEach(entry => inFlight.delete(entry.queryId));
  }
}

/** 只取消指定看板尚未发出的请求，避免卸载一个看板时影响其他看板。 */
export function cancelPendingWidgetFetches(boardId: string): void {
  const cancelled = pendingQueue.filter(entry => entry.boardId === boardId);
  pendingQueue = pendingQueue.filter(entry => entry.boardId !== boardId);

  cancelled.forEach(entry => {
    entry.reject(new Error('Widget fetch cancelled'));
  });

  Array.from(inFlight.values())
    .filter(entry => entry.boardId === boardId)
    .forEach(entry => {
      entry.reject(new Error('Widget fetch cancelled'));
      void request2({
        method: 'POST',
        url: `data-provider/execute/cancel/${entry.queryId}`,
      }).catch(() => undefined);
    });

  if (pendingQueue.length === 0 && flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}
