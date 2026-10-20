import { render } from '@testing-library/react';
import { vi } from 'vitest';
import MonacoEditor from '../MonacoEditor';

const monacoMock = vi.hoisted(() => ({ props: null as any }));
vi.mock('react-monaco-editor', () => ({
  default: (props: any) => {
    monacoMock.props = props;
    return null;
  },
  monaco: {},
}));

describe('React 19 Monaco editor compatibility', () => {
  it('supplies the lifecycle callbacks that function defaultProps no longer provide', () => {
    const { unmount } = render(<MonacoEditor value="SELECT 1" language="sql" />);
    expect(monacoMock.props.value).toBe('SELECT 1');
    expect(monacoMock.props.language).toBe('sql');
    for (const name of ['editorWillMount', 'editorDidMount', 'editorWillUnmount', 'onChange']) {
      expect(typeof monacoMock.props[name]).toBe('function');
    }
    expect(() => monacoMock.props.editorWillUnmount({}, {})).not.toThrow();
    expect(() => unmount()).not.toThrow();
  });

  it('preserves the caller-provided cleanup callback', () => {
    const onUnmount = vi.fn();
    render(<MonacoEditor editorWillUnmount={onUnmount} value="SELECT 2" />);
    monacoMock.props.editorWillUnmount({}, {});
    expect(onUnmount).toHaveBeenCalledTimes(1);
  });

  it('restores every missing default that the vendor expects at mount', () => {
    render(<MonacoEditor />);
    expect(monacoMock.props.value).toBeNull();
    expect(monacoMock.props.defaultValue).toBe('');
    expect(monacoMock.props.width).toBe('100%');
    expect(monacoMock.props.height).toBe('100%');
    expect(monacoMock.props.options).toEqual({});
    expect(monacoMock.props.overrideServices).toEqual({});
  });
});
