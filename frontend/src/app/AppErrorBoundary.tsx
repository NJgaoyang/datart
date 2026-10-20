import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Last-resort view recovery for React 19 rendering exceptions.
 * Never show raw errors or stack traces to users: those can contain
 * SQL fragments, private identifiers, and server response details.
 */
export default class AppErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Datart page rendering failed', error, info);
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <main
        role="alert"
        style={{
          width: '100%',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 14,
          background: '#fff',
          color: '#1f2937',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <h2 style={{ margin: 0 }}>页面加载失败</h2>
        <p style={{ color: '#6b7280', margin: 0 }}>
          当前操作遇到前端渲染异常。已保存的数据不会因刷新页面而自动删除。
        </p>
        <p style={{ color: '#6b7280', margin: 0 }}>
          请刷新重试；如果问题持续，请联系管理员查看浏览器控制台。
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            border: 0,
            borderRadius: 6,
            padding: '10px 20px',
            color: '#fff',
            background: '#1677ff',
            cursor: 'pointer',
          }}
        >
          刷新页面
        </button>
      </main>
    );
  }
}
