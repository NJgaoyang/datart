/**
 * Datart
 *
 * Copyright 2021
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Divider, Row } from 'antd';
import {
  ChartComputedFieldHandle,
  FunctionDescription,
} from 'app/types/ComputedFieldEditor';
import debounce from 'lodash/debounce';
import {
  forwardRef,
  ForwardRefRenderFunction,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import MonacoEditor from 'react-monaco-editor';
import styled from 'styled-components';
import ChartComputedFieldEditorDarkTheme from './ChartComputedFieldEditorDarkTheme';
import DatartQueryLanguageSpecification from './DatartQueryLanguageSpecification';
import { registerDqlLanguage } from './registerDqlLanguage';

const ChartComputedFieldEditor: ForwardRefRenderFunction<
  ChartComputedFieldHandle,
  {
    value?: string;
    functionDescriptions?: FunctionDescription[];
    onChange: (expression: string) => void;
  }
> = (props, ref) => {
  const editorRef = useRef<any>(null);
  const [editorText, setEditorText] = useState(props.value || '');
  const [description, setDescription] = useState<FunctionDescription>();

  useEffect(() => {
    setEditorText(props.value || '');
  }, [props.value]);

  useImperativeHandle(ref, () => ({
    insertField: (value, funcDesc) => {
      if (!value) {
        return;
      }
      if (funcDesc) {
        setDescription(funcDesc);
      }
      editorRef?.current?.trigger('keyboard', 'type', { text: value });
      editorRef?.current?.focus();
    },
  }));

  const getEditorNewLineCharactor = () => {
    return editorRef?.current?.getModel()?.getEOL();
  };

  const onChange = debounce(newValue => {
    const expression = newValue || '';
    setEditorText(expression);

    const newLineCharactor = getEditorNewLineCharactor();
    props.onChange(
      newLineCharactor
        ? expression.replaceAll(newLineCharactor, ' ')
        : expression,
    );
  }, 200);

  const handleDescriptionChange = debounce(descKey => {
    if (!descKey) {
      return;
    }
    const funcDesc = props.functionDescriptions?.find(d => d.name === descKey);
    if (!!funcDesc) {
      setDescription(funcDesc);
    }
  }, 200);

  const handleEdtiorWillMount = monacoEditor => {
    registerDqlLanguage(monacoEditor);
    monacoEditor.languages.setMonarchTokensProvider('dql', {
      ...DatartQueryLanguageSpecification,
      builtinFunctions: (props?.functionDescriptions || []).map(f => f.name),
    });
    monacoEditor.editor.defineTheme(
      'dqlTheme',
      ChartComputedFieldEditorDarkTheme,
    );
  };

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    const model = editor.getModel();

    editor.onDidChangeCursorPosition(listener => {
      const positionWord = model.getWordAtPosition(listener.position);
      handleDescriptionChange(positionWord?.word);
    });
  };

  const renderFunctionDescriptionInfo = () => {
    if (!description) {
      return '';
    }
    return `${description.description}: ${description.syntax}`;
  };

  return (
    <StyledChartComputedFieldEditor>
      <Row>
        <MonacoEditor
          theme="dqlTheme"
          language="dql"
          value={editorText}
          onChange={onChange}
          editorWillMount={handleEdtiorWillMount}
          editorDidMount={handleEditorDidMount}
          overrideServices={
            {
              // onDidChangeCursorPosition: () => console.log('overrideServices |onDidChangeCursorPosition ---->'),
            }
          }
          options={{
            lineDecorationsWidth: 1,
          }}
        />
      </Row>
      <Row>
        <Divider />
        <p>{renderFunctionDescriptionInfo()}</p>
      </Row>
    </StyledChartComputedFieldEditor>
  );
};

export default forwardRef(ChartComputedFieldEditor);

const StyledChartComputedFieldEditor = styled.div`
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 10px;
  overflow: hidden;
  color: #d4d4d4;
  background-color: #1e1e1e;

  & > .ant-row:first-child {
    flex: 1;
    min-height: 0;
  }

  & > .ant-row:last-child {
    flex-shrink: 0;

    .ant-divider {
      border-color: #3c3c3c;
    }
  }
`;
