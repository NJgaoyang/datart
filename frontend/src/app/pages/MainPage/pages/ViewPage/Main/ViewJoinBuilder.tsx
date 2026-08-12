import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Alert, Button, Form, Input, Modal, Select, Space } from 'antd';
import useI18NPrefix from 'app/hooks/useI18NPrefix';
import { CommonFormTypes } from 'globalConstants';
import { memo, useCallback, useContext, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { SPACE_LG, SPACE_MD, SPACE_XS } from 'styles/StyleConstants';
import { request2 } from 'utils/request';
import { getInsertedNodeIndex } from 'utils/utils';
import { SaveFormContext } from '../SaveFormContext';
import { viewActions } from '../slice';
import { selectCurrentEditingViewAttr, selectViews } from '../slice/selectors';
import { runSql, saveView } from '../slice/thunks';

interface ViewDetail {
  id: string;
  name: string;
  sourceId: string;
  model: string | { columns?: Record<string, unknown> };
}

interface ComposeResult {
  sourceId: string;
  script: string;
  config: string;
}

const parseColumns = (view?: ViewDetail) => {
  if (!view?.model) return [];
  try {
    const model =
      typeof view.model === 'string' ? JSON.parse(view.model) : view.model;
    return Object.keys(model?.columns || {});
  } catch {
    return [];
  }
};

export const ViewJoinBuilder = memo(() => {
  const dispatch = useDispatch();
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
  const [generated, setGenerated] = useState<ComposeResult>();
  const [previewVisible, setPreviewVisible] = useState(false);
  const [form] = Form.useForm();

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
      setDetails(current => ({ ...current, [id]: data }));
      return data;
    },
    [details],
  );

  const generate = useCallback(async () => {
    const values = await form.validateFields();
    setLoading(true);
    try {
      const { data } = await request2<ComposeResult>({
        url: '/views/compose',
        method: 'POST',
        data: values,
      });
      setGenerated(data);
      setPreviewVisible(true);
    } finally {
      setLoading(false);
    }
  }, [form]);

  const applyGeneratedSql = useCallback(() => {
    if (!generated) return;
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
  }, [dispatch, generated]);

  const executeGeneratedSql = useCallback(() => {
    if (!generated) return;
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
  }, [currentViewId, dispatch, generated]);

  const saveGeneratedView = useCallback(() => {
    if (!generated) return;
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
      visible: true,
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
  }, [dispatch, generated, showSaveForm, t, views]);

  const leftColumns = parseColumns(leftId ? details[leftId] : undefined);
  const rightColumns = parseColumns(rightId ? details[rightId] : undefined);

  return (
    <Wrapper>
      <h2>{t('title')}</h2>
      <Alert message={t('description')} type="info" showIcon />
      <Form
        form={form}
        layout="vertical"
        initialValues={{ joinType: 'INNER', conditions: [{}] }}
      >
        <ViewRow>
          <Form.Item
            name="leftViewId"
            label={t('leftView')}
            rules={[{ required: true }]}
          >
            <Select
              showSearch
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
                setLeftId(id);
                const detail = await loadView(id);
                dispatch(
                  viewActions.changeCurrentEditingView({
                    sourceId: detail?.sourceId,
                    error: '',
                  }),
                );
              }}
              optionFilterProp="label"
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
              showSearch
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
                setRightId(id);
                const detail = await loadView(id);
                dispatch(
                  viewActions.changeCurrentEditingView({
                    sourceId: detail?.sourceId,
                    error: '',
                  }),
                );
              }}
              optionFilterProp="label"
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
                    <Select options={leftColumns.map(value => ({ value }))} />
                  </Form.Item>
                  <span>=</span>
                  <Form.Item
                    {...field}
                    name={[field.name, 'rightColumn']}
                    label={index === 0 ? ' ' : undefined}
                    rules={[{ required: true }]}
                  >
                    <Select options={rightColumns.map(value => ({ value }))} />
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
        visible={previewVisible}
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
