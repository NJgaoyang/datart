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

import { useEffect } from 'react';
import { cancelQuery } from 'utils/queryCancellation';
import { useSourceSlice } from '../SourcePage/slice';
import { Container } from './Container';
import ViewErrorBoundary from './ErrorBoundary';
import { EditorContext, useEditorContext } from './EditorContext';
import { SaveFormContext, useSaveFormContext } from './SaveFormContext';
import { useViewSlice } from './slice';

export function ViewPage() {
  useViewSlice();
  useSourceSlice();
  const saveFormContextValue = useSaveFormContext();
  const editorContextValue = useEditorContext();

  useEffect(() => () => cancelQuery('view-preview'), []);

  return (
    <EditorContext.Provider value={editorContextValue}>
      <SaveFormContext.Provider value={saveFormContextValue}>
        <ViewErrorBoundary>
          <Container />
        </ViewErrorBoundary>
      </SaveFormContext.Provider>
    </EditorContext.Provider>
  );
}
