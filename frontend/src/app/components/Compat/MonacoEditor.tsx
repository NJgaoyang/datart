/**
 * React 19 no longer applies defaultProps on function components.
 * react-monaco-editor@0.55.0 still depends on defaultProps for its lifecycle
 * callbacks, including editorWillUnmount; without it switching/saving a SQL
 * view throws "d is not a function" during effect cleanup.
 *
 * Keep this wrapper until react-monaco-editor implements default parameters.
 * All Datart Monaco use sites must import it rather than the package directly.
 */
import type { ComponentProps } from 'react';
import ThirdPartyMonacoEditor from 'react-monaco-editor';

export { monaco } from 'react-monaco-editor';

type MonacoProps = ComponentProps<typeof ThirdPartyMonacoEditor>;

const noop = () => {};

export default function MonacoEditor(props: MonacoProps) {
  return (
    <ThirdPartyMonacoEditor
      {...props}
      width={props.width ?? '100%'}
      height={props.height ?? '100%'}
      value={props.value ?? null}
      defaultValue={props.defaultValue ?? ''}
      language={props.language ?? 'javascript'}
      options={props.options ?? {}}
      overrideServices={props.overrideServices ?? {}}
      editorWillMount={props.editorWillMount ?? noop}
      editorDidMount={props.editorDidMount ?? noop}
      editorWillUnmount={props.editorWillUnmount ?? noop}
      onChange={props.onChange ?? noop}
    />
  );
}
