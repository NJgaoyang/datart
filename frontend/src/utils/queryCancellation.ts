import { request2 } from './request';

type RunningQuery = { queryId: string; controller: AbortController; shareToken?: string };

const runningQueries = new Map<string, RunningQuery>();

const createQueryId = () =>
  globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;

export function startQuery(scope: string, shareToken?: string) {
  cancelQuery(scope);
  const query = { queryId: createQueryId(), controller: new AbortController(), shareToken };
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
    url: query.shareToken ? `shares/execute/cancel/${query.queryId}` : `data-provider/execute/cancel/${query.queryId}`,
    ...(query.shareToken ? { params: { executeToken: query.shareToken } } : {}),
  }).catch(() => undefined);
}
