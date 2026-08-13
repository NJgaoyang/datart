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
import { Modal } from 'antd';
import useI18NPrefix from 'app/hooks/useI18NPrefix';
import { WidgetInfo } from 'app/pages/DashBoardPage/pages/Board/slice/types';
import { editBoardStackActions } from 'app/pages/DashBoardPage/pages/BoardEditor/slice';
import { Widget } from 'app/pages/DashBoardPage/types/widgetTypes';
import { produce } from 'immer';
import { DeltaStatic } from 'quill';
import { ImageDrop } from 'quill-image-drop-module'; // 拖动加载图片组件。
import QuillMarkdown from 'quilljs-markdown';
import 'quilljs-markdown/dist/quilljs-markdown-common-style.css';
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import ReactQuill, { Quill } from 'react-quill-new';
// DeltaStatic
import 'react-quill-new/dist/quill.snow.css';
import { useDispatch } from 'react-redux';
import styled from 'styled-components';
import { FONT_FAMILIES, FONT_SIZES } from 'globalConstants';
import { SPACE_TIMES } from 'styles/StyleConstants';
import { WidgetActionContext } from '../../ActionProvider/WidgetActionProvider';
import { Formats, MarkdownOptions } from './config';

Quill.register('modules/imageDrop', ImageDrop);

const size = Quill.import('attributors/style/size') as any;
size.whitelist = FONT_SIZES.map(fontSize => `${fontSize}px`);
Quill.register(size, true);

const font = Quill.import('attributors/style/font') as any;
font.whitelist = FONT_FAMILIES.map(item => item.value);
Quill.register(font, true);

const RICH_TEXT_MODULES = {
  toolbar: [
    [{ font: [] }, { size: [] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ color: [] }, { background: [] }],
    [{ align: [] }, { indent: '-1' }, { indent: '+1' }],
    [{ list: 'ordered' }, { list: 'bullet' }, 'blockquote', 'code-block'],
    ['link', 'image', 'clean'],
  ],
  imageDrop: true,
};

type RichTextWidgetProps = {
  widget: Widget;
  widgetInfo: WidgetInfo;
  boardEditing: boolean;
};
export const RichTextWidgetCore: React.FC<RichTextWidgetProps> = ({
  widget,
  widgetInfo,
  boardEditing,
}) => {
  const t = useI18NPrefix();
  const dispatch = useDispatch();

  const { onEditClearActiveWidgets } = useContext(WidgetActionContext);
  const initContent = useMemo(() => {
    return (widget.config.content as any).richText?.content;
  }, [widget.config.content]);
  const [quillValue, setQuillValue] = useState<DeltaStatic | undefined>(
    initContent,
  );
  const [contentSavable, setContentSavable] = useState(false);
  const markdownInitialized = useRef(false);

  useEffect(() => {
    if (widgetInfo.editing) {
      setQuillValue(initContent);
    }
  }, [initContent, widgetInfo.editing]);

  useEffect(() => {
    if (widgetInfo.editing === false && contentSavable && boardEditing) {
      if (quillRef.current) {
        let contents = quillRef.current?.getEditor().getContents();
        const strContents = JSON.stringify(contents);
        if (strContents !== JSON.stringify(initContent)) {
          const nextMediaWidgetContent = produce(
            widget.config.content,
            draft => {
              (draft as any).richText = {
                content: JSON.parse(strContents || '{}'),
              };
            },
          ) as any;

          dispatch(
            editBoardStackActions.changeMediaWidgetConfig({
              id: widget.id,
              mediaWidgetContent: nextMediaWidgetContent,
            }),
          );
          setContentSavable(false);
        }
      }
    }
  }, [
    boardEditing,
    dispatch,
    initContent,
    contentSavable,
    widget.config.content,
    widget.id,
    widgetInfo.editing,
  ]);

  const quillRef = useRef<ReactQuill>(null);

  useEffect(() => {
    if (!markdownInitialized.current && quillRef.current) {
      new QuillMarkdown(quillRef.current.getEditor(), MarkdownOptions);
      markdownInitialized.current = true;
    }
  }, [widgetInfo.editing]);

  const ssp = e => {
    e.stopPropagation();
  };

  const quillChange = useCallback(() => {
    if (quillRef.current && quillRef.current?.getEditor()) {
      let contents = quillRef.current!.getEditor().getContents();
      setQuillValue(contents);
    }
  }, []);

  const modalCancel = useCallback(() => {
    onEditClearActiveWidgets();
  }, [onEditClearActiveWidgets]);

  const modalOk = useCallback(() => {
    setContentSavable(true);
    modalCancel();
  }, [modalCancel]);

  return (
    <TextWrap onClick={ssp}>
      <ReactQuill
        className="react-quill"
        value={initContent}
        modules={{ toolbar: null }}
        formats={Formats}
        readOnly={true}
      />
      <Modal
        width={992}
        closable={false}
        maskClosable={false}
        keyboard={false}
        visible={widgetInfo.editing}
        onOk={modalOk}
        onCancel={modalCancel}
      >
        <ModalBody>
          <ReactQuill
            ref={quillRef}
            className="react-quill"
            placeholder={t('viz.board.setting.enterHere')}
            value={quillValue}
            onChange={quillChange}
            modules={RICH_TEXT_MODULES}
            formats={Formats}
            readOnly={false}
          />
        </ModalBody>
      </Modal>
    </TextWrap>
  );
};
export default RichTextWidgetCore;

const TextWrap = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;

  & .react-quill {
    width: 100%;
    height: 100%;
  }

  & .ql-snow {
    border: none;
  }

  & .ql-container.ql-snow {
    border: none;
  }

  & .ql-editor {
    position: absolute;
    top: 50%;
    left: 0;
    width: 100%;
    height: auto;
    max-height: 100%;
    transform: translate(0, -50%);
  }
`;

const ModalBody = styled.div`
  .ql-toolbar {
    min-height: 42px;
    overflow: visible;
  }

  .ql-toolbar .ql-picker-options {
    z-index: 1;
  }

  & .ql-editor {
    min-height: ${SPACE_TIMES(60)};
  }
`;
