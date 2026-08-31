import { request2 } from './request';

type RunningQuery = { queryId: string; controller: AbortController };

const runningQueries = new Map<string, RunningQuery>();

const createQueryId = () =>
  globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;

export function startQuery(scope: string) {
  cancelQuery(scope);
  const query = { queryId: createQueryId(), controller: new AbortController() };
  runningQueries.set(scope, query);
  return {
    queryId: query.queryId,
    signal: query.controller.signal,
    finish: () => {
      if (runningQueries.get(scope) === query) runningQueries.delete(scope);
    },
  };
}

export function cancelQuery(scope: string) {
  const query = runningQueries.get(scope);
  if (!query) return;
  runningQueries.delete(scope);
  query.controller.abort();
  void request2({
    method: 'POST',
    url: `data-provider/execute/cancel/${query.queryId}`,
  }).catch(() => undefined);
}
