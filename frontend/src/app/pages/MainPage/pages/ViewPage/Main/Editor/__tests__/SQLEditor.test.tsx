import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import { ViewStatus, ViewViewModelStages } from '../../../constants';
import { SQLEditor } from '../SQLEditor';

const mocks = vi.hoisted(() => ({
  currentId: 'first',
  views: {} as Record<string, { id: string; script: string; status: number; stage: number }>,
  dispatch: vi.fn(),
  changeEditor: (_value: string) => {},
  mountEditor: (_editor: unknown) => {},
  editorOptions: {} as { readOnly?: boolean; readOnlyMessage?: { value: string } },
  actions: {
    changeCurrentEditingView: payload => ({ type: 'change', payload }),
  },
}));

vi.mock('app/components/CodeEditor', () => ({
  default: ({ value, onChange, onMount, options }) => {
    mocks.changeEditor = onChange;
    mocks.mountEditor = onMount;
    mocks.editorOptions = options;
    return (
      <textarea
        aria-label="SQL"
        value={value}
        readOnly={options.readOnly}
        onChange={event => onChange(event.target.value)}
      />
    );
  },
  monaco: { KeyMod: { CtrlCmd: 1 }, KeyCode: { Enter: 2, KeyS: 3 } },
}));
vi.mock('monaco-editor/esm/vs/basic-languages/sql/sql', () => ({ language: {} }));
vi.mock('monaco-editor/esm/vs/editor/editor.api', () => ({}));
vi.mock('monaco-editor/esm/vs/editor/contrib/readOnlyMessage/browser/contribution', () => ({}));
vi.mock('react-hotkeys-hook', () => ({ useHotkeys: () => {} }));
vi.mock('redux/hooks', () => ({ useAppDispatch: () => mocks.dispatch }));
vi.mock('react-redux', () => ({ useSelector: selector => selector({}) }));
vi.mock('app/hooks/useI18NPrefix', () => ({ default: () => key => key }));
vi.mock('styles/theme/slice/selectors', () => ({ selectThemeKey: () => 'light' }));
vi.mock('utils/utils', () => ({ getInsertedNodeIndex: () => 0 }));
vi.mock('app/pages/MainPage/pages/ViewPage/utils', () => ({ isNewView: () => false }));
vi.mock('app/pages/MainPage/pages/ViewPage/slice', () => ({
  useViewSlice: () => ({ actions: mocks.actions }),
}));
vi.mock('app/pages/MainPage/pages/ViewPage/slice/selectors', () => ({
  selectCurrentEditingViewAttr: (_state, { name }) => mocks.views[mocks.currentId][name],
  selectViews: () => [],
}));
vi.mock('app/pages/MainPage/pages/ViewPage/slice/thunks', () => ({
  getEditorProvideCompletionItems: vi.fn(),
  runSql: vi.fn(),
  saveView: vi.fn(),
}));

describe('SQL editor draft persistence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.currentId = 'first';
    mocks.views = {
      first: { id: 'first', script: 'SELECT 1', status: ViewStatus.Active, stage: ViewViewModelStages.Saved },
      second: { id: 'second', script: 'SELECT 2', status: ViewStatus.Active, stage: ViewViewModelStages.Saved },
    };
    mocks.dispatch.mockReset();
    mocks.dispatch.mockImplementation(action => {
      if (action.type === 'change') {
        Object.assign(mocks.views[mocks.currentId], action.payload);
      }
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('keeps the final edit when another editor opens before any timer runs', () => {
    const { rerender } = render(<SQLEditor key="first" allowManage />);
    const script = 'SELECT 1 -- final edit';
    fireEvent.change(screen.getByRole('textbox', { name: 'SQL' }), {
      target: { value: script },
    });

    // No timer is advanced between the input and the editor switch.
    mocks.currentId = 'second';
    rerender(<SQLEditor key="second" allowManage />);
    expect(screen.getByRole('textbox', { name: 'SQL' })).toHaveValue('SELECT 2');
    vi.runAllTimers();
    expect(mocks.views.second.script).toBe('SELECT 2');

    mocks.currentId = 'first';
    rerender(<SQLEditor key="first" allowManage />);
    expect(screen.getByRole('textbox', { name: 'SQL' })).toHaveValue(script);
  });

  it.each([
    { allowManage: false, status: ViewStatus.Active },
    { allowManage: true, status: ViewStatus.Archived },
  ])('rejects draft updates with allowManage=$allowManage and status=$status', ({ allowManage, status }) => {
    mocks.views.first.status = status;
    render(<SQLEditor allowManage={allowManage} />);
    const editor = screen.getByRole('textbox', { name: 'SQL' });
    expect(editor).toHaveAttribute('readonly');

    fireEvent.change(editor, { target: { value: 'SELECT changed' } });
    vi.runAllTimers();
    expect(mocks.views.first.script).toBe('SELECT 1');
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it('does not mark the draft changed for an unchanged editor value', () => {
    render(<SQLEditor allowManage />);
    act(() => mocks.changeEditor('SELECT 1'));
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it('uses the public read-only message option without requiring a private contribution', () => {
    const readOnlyListeners: Array<() => void> = [];
    const editor = {
      getContribution: vi.fn(() => null),
      getPosition: () => ({ lineNumber: 1, column: 1 }),
      onDidChangeCursorSelection: vi.fn(),
      onDidAttemptReadOnlyEdit: vi.fn(listener => {
        readOnlyListeners.push(listener);
      }),
    };
    render(<SQLEditor allowManage={false} />);

    expect(() => {
      act(() => {
        mocks.mountEditor(editor);
        readOnlyListeners.forEach(listener => listener());
      });
    }).not.toThrow();
    expect(editor.getContribution).not.toHaveBeenCalled();
    expect(mocks.editorOptions).toMatchObject({
      readOnly: true,
      readOnlyMessage: { value: 'readOnlyEditorTip' },
    });
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });
});
