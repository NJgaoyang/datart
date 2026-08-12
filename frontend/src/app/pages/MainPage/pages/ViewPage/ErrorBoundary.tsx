/**
 * Datart ViewPage ErrorBoundary
 * Catches rendering errors to prevent white screen crash
 */

import { Button, Typography } from 'antd';
import React, { Component, ErrorInfo, ReactNode } from 'react';

const { Paragraph, Text } = Typography;

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ViewErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error(
      '%c[ViewErrorBoundary] Caught rendering error:',
      'color: red; font-weight: bold',
      error,
      errorInfo,
    );
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorStack = this.state.error?.stack || '';
      const componentStack = this.state.errorInfo?.componentStack || '';

      return (
        <div
          style={{
            padding: 32,
            textAlign: 'center',
            background: '#fff2f0',
            border: '1px solid #ffccc7',
            borderRadius: 8,
            margin: 16,
          }}
        >
          <Text type="danger" strong style={{ fontSize: 16 }}>
            View render error
          </Text>
          <Paragraph
            style={{ marginTop: 12, color: '#666', maxWidth: 600, margin: '12px auto' }}
            ellipsis={{ rows: 3, expandable: true, symbol: 'Show more' }}
          >
            {this.state.error?.message || 'Unknown error'}
          </Paragraph>
          <details style={{ marginTop: 12, textAlign: 'left', maxWidth: 700, margin: '12px auto' }}>
            <summary style={{ cursor: 'pointer', color: '#1890ff' }}>
              Stack trace
            </summary>
            <pre
              style={{
                fontSize: 11,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                background: '#f5f5f5',
                padding: 8,
                borderRadius: 4,
                marginTop: 8,
                maxHeight: 300,
                overflow: 'auto',
              }}
            >
              {errorStack}
              {componentStack && (
                <>
                  {'\n\n--- Component Stack ---\n'}
                  {componentStack}
                </>
              )}
            </pre>
          </details>
          <Button
            type="primary"
            style={{ marginTop: 12 }}
            onClick={() => window.location.reload()}
          >
            Refresh Page
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ViewErrorBoundary;
