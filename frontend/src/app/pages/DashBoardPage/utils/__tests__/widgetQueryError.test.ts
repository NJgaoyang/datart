import {
  getWidgetQueryErrorMessage,
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
  });
});
