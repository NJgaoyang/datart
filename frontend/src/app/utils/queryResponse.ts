/** Datart may reply with HTTP 200 yet `success:false`. Query callers must
 * not report these as an empty or valid data set. Preserve only structured
 * error codes, never the raw SQL/debug message, in the chart error channel.
 * Kept independent of UI utilities to avoid circular application chunks.
 */
export function unwrapWidgetQueryResponse<T>(response: {
  success?: boolean;
  errCode?: number;
  data: T;
}): T {
  if (response?.success === false) {
    const error = new Error('数据查询失败，请重试') as Error & { errCode?: number };
    error.errCode = response.errCode;
    throw error;
  }
  return response?.data;
}