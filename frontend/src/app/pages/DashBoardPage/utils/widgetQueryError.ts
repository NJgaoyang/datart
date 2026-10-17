import { getErrorMessage } from 'utils/utils';

/** Internal marker; never display raw backend/SQL details to dashboard viewers. */
export const WIDGET_QUERY_FORBIDDEN = '__DATART_WIDGET_QUERY_FORBIDDEN__';

/** Only structured HTTP 403 is treated as permission denial; message text is not authoritative. */
export const getWidgetQueryErrorMessage = (error: unknown): string => {
  const response = error as { status?: number; response?: { status?: number } } | null;
  if (response?.response?.status === 403 || response?.status === 403) {
    return WIDGET_QUERY_FORBIDDEN;
  }
  return getErrorMessage(error);
};
