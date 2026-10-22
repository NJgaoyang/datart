import {
  getWidgetQueryErrorMessage,
  unwrapWidgetQueryResponse,
  WIDGET_QUERY_FORBIDDEN,
} from '../widgetQueryError';

describe('chart query authorization errors', () => {
  it('only classifies a structured HTTP 403 as permission denied', () => {
    expect(getWidgetQueryErrorMessage({ response: { status: 403 } })).toBe(WIDGET_QUERY_FORBIDDEN);
    expect(getWidgetQueryErrorMessage({ status: 403 })).toBe(WIDGET_QUERY_FORBIDDEN);
    expect(getWidgetQueryErrorMessage({ response: { status: 500 }, message: 'server error' }))
      .not.toBe(WIDGET_QUERY_FORBIDDEN);
    expect(getWidgetQueryErrorMessage(new Error('403 occurs in SQL text')))
      .not.toBe(WIDGET_QUERY_FORBIDDEN);
    expect(getWidgetQueryErrorMessage({ errCode: 403 })).toBe(WIDGET_QUERY_FORBIDDEN);
    expect(getWidgetQueryErrorMessage({ response: { status: 200, data: { errCode: 403 } } }))
      .toBe(WIDGET_QUERY_FORBIDDEN);
    expect(getWidgetQueryErrorMessage({ data: { errCode: 403 } }))
      .toBe(WIDGET_QUERY_FORBIDDEN);
    expect(getWidgetQueryErrorMessage({ errCode: 500, message: 'database down' }))
      .not.toBe(WIDGET_QUERY_FORBIDDEN);
    expect(getWidgetQueryErrorMessage({ message: 'Permission denied: 403 in SQL' }))
      .not.toBe(WIDGET_QUERY_FORBIDDEN);
  });
});

describe('successful HTTP with a Datart business failure', () => {
  it('returns rows when the response is successful', () => {
    expect(unwrapWidgetQueryResponse({ success: true, data: { rows: [[3]] } }))
      .toEqual({ rows: [[3]] });
  });

  it('does not render success=false as an empty or ready data chart', () => {
    expect(() => unwrapWidgetQueryResponse({
      success: false,
      errCode: 500,
      data: { rows: [] },
    })).toThrow('数据查询失败，请重试');
  });

  it('classifies a structured 403 business failure without leaking SQL', () => {
    try {
      unwrapWidgetQueryResponse({
        success: false,
        errCode: 403,
        data: 'SELECT confidential FROM table',
      });
      throw new Error('Business failure was not rejected');
    } catch (error) {
      expect(getWidgetQueryErrorMessage(error)).toBe(WIDGET_QUERY_FORBIDDEN);
      expect(String(error)).not.toContain('confidential');
    }
  });
});
describe('missing chart query envelope', () => {
  it('rejects null and undefined responses', () => {
    expect(() => unwrapWidgetQueryResponse(undefined)).toThrow('数据查询失败');
    expect(() => unwrapWidgetQueryResponse(null)).toThrow('数据查询失败');
    expect(() => unwrapWidgetQueryResponse({ success: true, data: null }))
      .toThrow('数据查询失败');
  });

  it('treats an explicit empty rows array as valid data', () => {
    expect(unwrapWidgetQueryResponse({ success: true, data: { rows: [] } }))
      .toEqual({ rows: [] });
  });

  it('preserves business 403 information', () => {
    try {
      unwrapWidgetQueryResponse({ success: false, errCode: 403, data: null });
      throw new Error('not rejected');
    } catch (error) {
      expect(getWidgetQueryErrorMessage(error)).toBe(WIDGET_QUERY_FORBIDDEN);
    }
  });
});
