import { getErrorMessage } from 'utils/utils';

/** Internal marker; never display raw backend/SQL details to dashboard viewers. */
export const WIDGET_QUERY_FORBIDDEN = '__DATART_WIDGET_QUERY_FORBIDDEN__';

type StructuredWidgetError = {
  status?: number;
  errCode?: number;
  data?: { errCode?: number };
  response?: { status?: number; data?: { errCode?: number } };
};

/** Only structured status/errCode 403 means forbidden, never arbitrary text. */
export const getWidgetQueryErrorMessage = (error: unknown): string => {
  const typed = error as StructuredWidgetError | null;
  if ([
    typed?.status,
    typed?.errCode,
    typed?.data?.errCode,
    typed?.response?.status,
    typed?.response?.data?.errCode,
  ].includes(403)) {
    return WIDGET_QUERY_FORBIDDEN;
  }
  return getErrorMessage(error) || '数据查询失败，请重试';
};

export { unwrapWidgetQueryResponse } from 'app/utils/queryResponse';