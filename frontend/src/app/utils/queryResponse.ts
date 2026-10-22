/** Datart may reply with HTTP 200 yet `success:false`. Query callers must
 * not report these as an empty or valid data set. Preserve only structured
 * error codes, never the raw SQL/debug message, in the chart error channel.
 * Kept independent of UI utilities to avoid circular application chunks.
 */
export type ReportApiResponse<T> = {
  success?: boolean;
  errCode?: number;
  data?: T | null;
};

/** Fail on empty/malformed report responses rather than pretending
 * missing data is a successful empty dataset. Keep 403 codes structured. */
export function unwrapRequiredApiData<T>(
  response: ReportApiResponse<T> | null | undefined,
  message = '报表加载失败，请检查接口响应',
): T {
  if (!response || typeof response !== 'object' ||
      response.success === false || response.data == null) {
    const error = new Error(message) as Error & { errCode?: number };
    if (response && typeof response === 'object') {
      error.errCode = response.errCode;
    }
    throw error;
  }
  return response.data;
}

export function unwrapWidgetQueryResponse<T>(
  response: ReportApiResponse<T> | null | undefined,
): T {
  return unwrapRequiredApiData(response, '数据查询失败，请重试');
}
