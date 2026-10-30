import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Alert, Button, Form, Input, Modal, Select, Space } from 'antd';
import useI18NPrefix from 'app/hooks/useI18NPrefix';
import { ViewFieldMeta } from 'app/types/View';
import { CommonFormTypes } from 'globalConstants';
import {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSelector } from 'react-redux';
import { useAppDispatch } from 'redux/hooks';
import styled from 'styled-components';
import { SPACE_LG, SPACE_MD, SPACE_XS } from 'styles/StyleConstants';
import { request2 } from 'utils/request';
import {
  getDatasetFieldDisplayName,
  getFieldDisplayName,
  getInsertedNodeIndex,
} from 'utils/utils';
import { SaveFormContext } from '../SaveFormContext';
import { viewActions } from '../slice';
import { selectCurrentEditingViewAttr, selectViews } from '../slice/selectors';
import { runSql, saveView } from '../slice/thunks';
import { findViewFieldMeta } from '../utils';
import { getViewJoinSignature } from './viewJoinDraft';

interface ViewDetail {
  id: string;
  name: string;
  sourceId: string;
  model: string | { columns?: Record<string, any> };
  fields?: ViewFieldMeta[];
}

interface ComposeResult {
  sourceId: string;
  script: string;
  config: string;
}

interface GeneratedResult extends ComposeResult {
  signature: string;
}

const parseColumns = (view?: ViewDetail) => {
  if (!view?.model) return [];
  try {
    const model =
      typeof view.model === 'string' ? JSON.parse(view.model) : view.model;
    return Object.entries<any>(model?.columns || {}).map(([name, column]) => {
      const field = findViewFieldMeta(
        {
          fieldId: column.fieldId,
          name,
          path:
            column.path ||
            (Array.isArray(column.name) ? column.name : undefined),
        },
        view.fields,
      );
      return {
        value: name,
        label: field
          ? getDatasetFieldDisplayName(field)
          : getFieldDisplayName({ ...column, name }),
      };
    });
  } catch {
    return [];
  }
};

export const ViewJoinBuilder = memo(() => {
  const dispatch = useAppDispatch();
  const views = useSelector(selectViews);
  const currentViewId = useSelector(state =>
    selectCurrentEditingViewAttr(state, { name: 'id' }),
  ) as string;
  const { showSaveForm } = useContext(SaveFormContext);
  const t = useI18NPrefix('view.viewJoin');
  const [details, setDetails] = useState<Record<string, ViewDetail>>({});
  const [loading, setLoading] = useState(false);
  const [leftId, setLeftId] = useState<string>();
  const [rightId, setRightId] = useState<string>();
  const [generated, setGenerated] = useState<GeneratedResult>();
  const [needsRegeneration, setNeedsRegeneration] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [form] = Form.useForm();
  const generationVersion = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generationVersion.current += 1;
    };
  }, []);

  const invalidateGenerated = useCallback(() => {
    generationVersion.current += 1;
    if (generated || loading) setNeedsRegeneration(true);
    setGenerated(undefined);
    setPreviewVisible(false);
    setLoading(false);
  }, [generated, loading]);

  const options = useMemo(
    () =>
      (views || [])
        .filter(view => !view.isFolder)
        .map(view => ({ label: view.name, value: view.id })),
    [views],
  );

  const loadView = useCallback(
    async (id: string) => {
      if (!id || details[id]) return details[id];
      const { data } = await request2<ViewDetail>(`/views/${id}`);
      if (mounted.current) {
        setDetails(current => ({ ...current, [id]: data }));
      }
      return data;
    },
    [details],
  );

  const generate = useCallback(async () => {
    const values = await form.validateFields();
    if (!mounted.current) return;
    const version = ++generationVersion.current;
    const signature = getViewJoinSignature(values);
    setLoading(true);
    try {
      const { data } = await request2<ComposeResult>({
        url: '/views/compose',
        method: 'POST',
        data: values,
      });
      if (
        !mounted.current ||
        version !== generationVersion.current ||
        signature !== getViewJoinSignature(form.getFieldsValue(true))
      ) {
        return;
      }
      setGenerated({ ...data, signature });
      setNeedsRegeneration(false);
      setPreviewVisible(true);
    } finally {
      if (mounted.current && version === generationVersion.current) {
        setLoading(false);
      }
    }
  }, [form]);

  const applyGeneratedSql = useCallback(() => {
    if (
      !generated ||
      generated.signature !== getViewJoinSignature(form.getFieldsValue(true))
    ) {
      return;
    }
    dispatch(
      viewActions.changeCurrentEditingView({
        type: 'SQL',
        sourceId: generated.sourceId,
        script: generated.script,
        config: JSON.parse(generated.config),
        touched: true,
      }),
    );
    setPreviewVisible(false);
  }, [dispatch, generated, form]);

  const executeGeneratedSql = useCallback(() => {
    if (
      !generated ||
      generated.signature !== getViewJoinSignature(form.getFieldsValue(true))
    ) {
      return;
    }
    dispatch(
      viewActions.changeCurrentEditingView({
        type: 'SQL',
        sourceId: generated.sourceId,
        script: generated.script,
        config: JSON.parse(generated.config),
        touched: true,
      }),
    );
    setPreviewVisible(false);
    dispatch(runSql({ id: currentViewId, isFragment: false }));
  }, [currentViewId, dispatch, generated, form]);

  const saveGeneratedView = useCallback(() => {
    if (
      !generated ||
      generated.signature !== getViewJoinSignature(form.getFieldsValue(true))
    ) return;
    const generatedConfig = JSON.parse(generated.config);
    dispatch(
      viewActions.changeCurrentEditingView({
        type: 'SQL',
        sourceId: generated.sourceId,
        script: generated.script,
        config: generatedConfig,
        touched: true,
      }),
    );
    setPreviewVisible(false);
    showSaveForm({
      type: CommonFormTypes.Edit,
      open: true,
      parentIdLabel: t('folder'),
      initialValues: {
        name: '',
        parentId: '',
        config: generatedConfig,
      },
      onSave: (values, onClose) => {
        const index = getInsertedNodeIndex(values, views);
        dispatch(
          viewActions.changeCurrentEditingView({
            ...values,
            parentId: values.parentId || null,
            index,
          }),
        );
        dispatch(saveView({ resolve: onClose }));
      },
    });
  }, [dispatch, generated, showSaveForm, t, views, form]);

  const leftColumns = parseColumns(leftId ? details[leftId] : undefined);
  const rightColumns = parseColumns(rightId ? details[rightId] : undefined);

  return (
    <Wrapper>
      <h2>{t('title')}</h2>
      <Alert title={t('description')} type="info" showIcon />
      {needsRegeneration && (
        <Alert title={t('regenerateRequired')} type="warning" showIcon />
      )}
      <Form
        form={form}
        layout="vertical"
        initialValues={{ joinType: 'INNER', conditions: [{}] }}
        onValuesChange={invalidateGenerated}
      >
        <ViewRow>
          <Form.Item
            name="leftViewId"
            label={t('leftView')}
            rules={[{ required: true }]}
          >
            <Select
              options={options.filter(option => {
                const rightSourceId = views?.find(
                  view => view.id === rightId,
                )?.sourceId;
                const optionSourceId = views?.find(
                  view => view.id === option.value,
                )?.sourceId;
                return (
                  option.value !== rightId &&
                  (!rightSourceId || optionSourceId === rightSourceId)
                );
              })}
              onChange={async value => {
                const id = String(value);
                invalidateGenerated();
                form.setFieldValue('conditions',
                  (form.getFieldValue('conditions') || [{}]).map(condition => ({
                    ...condition,
                    leftColumn: undefined,
                  })),
                );
                setLeftId(id);
                const detail = await loadView(id);
                if (!mounted.current || form.getFieldValue('leftViewId') !== id) return;
                dispatch(
                  viewActions.changeCurrentEditingView({
                    sourceId: detail?.sourceId,
                    error: '',
                  }),
                );
              }}
              showSearch={{ optionFilterProp: 'label' }}
            />
          </Form.Item>
          <Form.Item
            name="joinType"
            label={t('joinType')}
            rules={[{ required: true }]}
          >
            <Select
              options={['INNER', 'LEFT', 'RIGHT', 'FULL'].map(value => ({
                value,
                label: t(value),
              }))}
            />
          </Form.Item>
          <Form.Item
            name="rightViewId"
            label={t('rightView')}
            rules={[{ required: true }]}
          >
            <Select
              options={options.filter(option => {
                const leftSourceId = views?.find(
                  view => view.id === leftId,
                )?.sourceId;
                const optionSourceId = views?.find(
                  view => view.id === option.value,
                )?.sourceId;
                return (
                  option.value !== leftId &&
                  (!leftSourceId || optionSourceId === leftSourceId)
                );
              })}
              onChange={async value => {
                const id = String(value);
                invalidateGenerated();
                form.setFieldValue('conditions',
                  (form.getFieldValue('conditions') || [{}]).map(condition => ({
                    ...condition,
                    rightColumn: undefined,
                  })),
                );
                setRightId(id);
                const detail = await loadView(id);
                if (!mounted.current || form.getFieldValue('rightViewId') !== id) return;
                dispatch(
                  viewActions.changeCurrentEditingView({
                    sourceId: detail?.sourceId,
                    error: '',
                  }),
                );
              }}
              showSearch={{ optionFilterProp: 'label' }}
            />
          </Form.Item>
        </ViewRow>

        <Form.List name="conditions">
          {(fields, { add, remove }) => (
            <>
              {fields.map((field, index) => (
                <ConditionRow key={field.key}>
                  <Form.Item
                    {...field}
                    name={[field.name, 'leftColumn']}
                    label={index === 0 ? t('joinCondition') : undefined}
                    rules={[{ required: true }]}
                  >
                    <Select options={leftColumns} />
                  </Form.Item>
                  <span>=</span>
                  <Form.Item
                    {...field}
                    name={[field.name, 'rightColumn']}
                    label={index === 0 ? ' ' : undefined}
                    rules={[{ required: true }]}
                  >
                    <Select options={rightColumns} />
                  </Form.Item>
                  {fields.length > 1 && (
                    <Button
                      type="text"
                      icon={<DeleteOutlined />}
                      onClick={() => remove(field.name)}
                    />
                  )}
                </ConditionRow>
              ))}
              <Button icon={<PlusOutlined />} onClick={() => add()}>
                {t('addCondition')}
              </Button>
            </>
          )}
        </Form.List>
        <Space>
          <Button type="primary" loading={loading} onClick={generate}>
            {t('generate')}
          </Button>
          {generated && (
            <Button onClick={saveGeneratedView}>{t('save')}</Button>
          )}
        </Space>
      </Form>
      <Modal
        title={t('previewTitle')}
        open={previewVisible}
        width="80%"
        onCancel={() => setPreviewVisible(false)}
        footer={[
          <Button key="back" onClick={() => setPreviewVisible(false)}>
            {t('back')}
          </Button>,
          <Button key="editor" onClick={applyGeneratedSql}>
            {t('openEditor')}
          </Button>,
          <Button key="save" onClick={saveGeneratedView}>
            {t('save')}
          </Button>,
          <Button key="execute" type="primary" onClick={executeGeneratedSql}>
            {t('execute')}
          </Button>,
        ]}
      >
        <PreviewHelp>{t('previewHelp')}</PreviewHelp>
        <Input.TextArea
          value={generated?.script}
          readOnly
          autoSize={{ minRows: 14, maxRows: 26 }}
        />
      </Modal>
    </Wrapper>
  );
});

const Wrapper = styled.div`
  flex: 1;
  padding: ${SPACE_LG};
  overflow: auto;

  h2,
  .ant-alert,
  .ant-form {
    margin-bottom: ${SPACE_MD};
  }
`;

const ViewRow = styled.div`
  display: grid;
  grid-template-columns: minmax(200px, 1fr) 140px minmax(200px, 1fr);
  gap: ${SPACE_MD};
`;

const ConditionRow = styled.div`
  display: grid;
  grid-template-columns: minmax(200px, 1fr) auto minmax(200px, 1fr) 40px;
  gap: ${SPACE_XS};
  align-items: center;

  > span {
    padding-top: ${SPACE_MD};
  }
`;

const PreviewHelp = styled.p`
  margin-bottom: ${SPACE_XS};
`;
