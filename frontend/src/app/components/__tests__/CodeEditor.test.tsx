import { render } from '@testing-library/react';
import { vi } from 'vitest';
import CodeEditor from '../CodeEditor';

const mock = vi.hoisted(() => {
  let value = '';
  let changed: (event: any) => void;
  const subscription = { dispose: vi.fn() };
  const model = { dispose: vi.fn() };
  const editor = {
    getValue: () => value,
    setValue: vi.fn((next: string) => {
      value = next;
      changed?.({});
    }),
    onDidChangeModelContent: vi.fn(fn => {
      changed = fn;
      return subscription;
    }),
    getModel: () => model,
    updateOptions: vi.fn(),
    dispose: vi.fn(),
  };
  return {
    editor,
    subscription,
    model,
    create: vi.fn((_element, options) => {
      value = options.value;
      return editor;
    }),
  };
});
vi.mock('monaco-editor/esm/vs/editor/editor.api', () => ({
  editor: { create: mock.create, setModelLanguage: vi.fn(), setTheme: vi.fn() },
}));

it('uses current callbacks, updates controlled values without dirtying the form, and disposes editor resources', () => {
  const onChange = vi.fn();
  const before = vi.fn();
  const mount = vi.fn();
  const view = render(
    <CodeEditor
      value="SELECT 1"
      onBeforeMount={before}
      onMount={mount}
      onChange={onChange}
    />,
  );
  expect(before).toHaveBeenCalledTimes(1);
  expect(mount).toHaveBeenCalledWith(mock.editor, expect.anything());
  view.rerender(<CodeEditor value="SELECT 2" onChange={onChange} />);
  expect(mock.editor.getValue()).toBe('SELECT 2');
  expect(onChange).not.toHaveBeenCalled();
  const nextChange = vi.fn();
  view.rerender(<CodeEditor value="SELECT 2" onChange={nextChange} />);
  mock.editor.setValue('SELECT 3');
  expect(nextChange).toHaveBeenCalledWith('SELECT 3', expect.anything());
  view.unmount();
  expect(mock.subscription.dispose).toHaveBeenCalledTimes(1);
  expect(mock.editor.dispose).toHaveBeenCalledTimes(1);
  expect(mock.model.dispose).toHaveBeenCalledTimes(1);
});
