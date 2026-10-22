import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { CSSProperties, useEffect, useLayoutEffect, useRef } from 'react';

export { monaco };

type CodeEditorProps = {
  value?: string;
  language?: string;
  theme?: string;
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  options?: monaco.editor.IStandaloneEditorConstructionOptions;
  onBeforeMount?: (api: typeof monaco) => void;
  onMount?: (
    editor: monaco.editor.IStandaloneCodeEditor,
    api: typeof monaco,
  ) => void;
  onChange?: (
    value: string,
    event: monaco.editor.IModelContentChangedEvent,
  ) => void;
};

export default function CodeEditor(props: CodeEditorProps) {
  const container = useRef<HTMLDivElement>(null);
  const editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const updating = useRef(false);

  useLayoutEffect(() => {
    const initial = latest.current;
    initial.onBeforeMount?.(monaco);
    const instance = monaco.editor.create(container.current!, {
      automaticLayout: true,
      ...initial.options,
      value: initial.value ?? '',
      language: initial.language,
      theme: initial.theme,
    });
    editor.current = instance;
    initial.onMount?.(instance, monaco);
    const subscription = instance.onDidChangeModelContent(event => {
      if (!updating.current)
        latest.current.onChange?.(instance.getValue(), event);
    });
    return () => {
      subscription.dispose();
      const model = instance.getModel();
      instance.dispose();
      model?.dispose();
      editor.current = null;
    };
  }, []);

  useEffect(() => {
    if (
      props.value !== undefined &&
      editor.current?.getValue() !== props.value
    ) {
      updating.current = true;
      try {
        editor.current?.setValue(props.value);
      } finally {
        updating.current = false;
      }
    }
  }, [props.value]);
  useEffect(() => {
    editor.current?.updateOptions(props.options ?? {});
  }, [props.options]);
  useEffect(() => {
    const model = editor.current?.getModel();
    if (model && props.language)
      monaco.editor.setModelLanguage(model, props.language);
  }, [props.language]);
  useEffect(() => {
    if (props.theme) monaco.editor.setTheme(props.theme);
  }, [props.theme]);

  return (
    <div
      ref={container}
      style={{ width: props.width ?? '100%', height: props.height ?? '100%' }}
    />
  );
}
