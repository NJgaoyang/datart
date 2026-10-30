import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Alert, Button, Form, Input, Modal, Select } from 'antd';
import useI18NPrefix from 'app/hooks/useI18NPrefix';
import { ViewFieldMeta } from 'app/types/View';
import { CommonFormTypes } from 'globalConstants';
import {
  memo,
  useCallback,
  useContext,
  useEffect,
  useId,
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
  const builderId = useId();
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
  const addConditionRef = useRef<HTMLButtonElement>(null);

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
      <Content>
        <Header>
          <h2 id={`${builderId}-title`}>{t('title')}</h2>
          <Description>{t('description')}</Description>
        </Header>
        {needsRegeneration && (
          <Alert
            title={t('regenerateRequired')}
            type="warning"
            showIcon
            role="status"
          />
        )}
        <Form
          form={form}
          layout="vertical"
          aria-labelledby={`${builderId}-title`}
          initialValues={{ joinType: 'INNER', conditions: [{}] }}
          onValuesChange={invalidateGenerated}
        >
          <FormSection aria-labelledby={`${builderId}-sources`}>
            <SectionHeader>
              <StepNumber aria-hidden="true">1</StepNumber>
              <h3 id={`${builderId}-sources`}>{t('sourcesTitle')}</h3>
            </SectionHeader>
            <ViewRow>
              <Form.Item
                name="leftViewId"
                label={t('leftView')}
                rules={[{ required: true }]}
              >
                <Select
                  placeholder={t('selectView')}
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
                    form.setFieldValue(
                      'conditions',
                      (form.getFieldValue('conditions') || [{}]).map(
                        condition => ({ ...condition, leftColumn: undefined }),
                      ),
                    );
                    setLeftId(id);
                    const detail = await loadView(id);
                    if (
                      !mounted.current ||
                      form.getFieldValue('leftViewId') !== id
                    ) return;
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
                  placeholder={t('selectView')}
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
                    form.setFieldValue(
                      'conditions',
                      (form.getFieldValue('conditions') || [{}]).map(
                        condition => ({ ...condition, rightColumn: undefined }),
                      ),
                    );
                    setRightId(id);
                    const detail = await loadView(id);
                    if (
                      !mounted.current ||
                      form.getFieldValue('rightViewId') !== id
                    ) return;
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
          </FormSection>

          <FormSection aria-labelledby={`${builderId}-conditions`}>
            <SectionHeader>
              <StepNumber aria-hidden="true">2</StepNumber>
              <h3 id={`${builderId}-conditions`}>{t('joinCondition')}</h3>
            </SectionHeader>
            <SectionHint id={`${builderId}-conditions-help`}>
              {t('conditionsDescription')}
            </SectionHint>
            <Form.List name="conditions">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field, index) => (
                    <ConditionRow
                      key={field.key}
                      role="group"
                      aria-labelledby={`${builderId}-condition-${field.key}`}
                      aria-describedby={`${builderId}-conditions-help`}
                    >
                      <ConditionHeading>
                        <h4 id={`${builderId}-condition-${field.key}`}>
                          {t('conditionNumber', false, { index: index + 1 })}
                        </h4>
                        {fields.length > 1 && (
                          <Button
                            type="text"
                            htmlType="button"
                            icon={<DeleteOutlined aria-hidden="true" />}
                            aria-label={t('removeCondition', false, { index: index + 1 })}
                            title={t('removeCondition', false, { index: index + 1 })}
                            onClick={() => {
                              remove(field.name);
                              addConditionRef.current?.focus();
                            }}
                          >
                            {t('remove')}
                          </Button>
                        )}
                      </ConditionHeading>
                      <ConditionFields>
                        <Form.Item
                          {...field}
                          name={[field.name, 'leftColumn']}
                          label={t('leftColumn')}
                          rules={[{ required: true }]}
                        >
                          <Select
                            options={leftColumns}
                            disabled={!leftId}
                            placeholder={t(
                              leftId ? 'selectField' : 'chooseLeftViewFirst',
                            )}
                            showSearch={{ optionFilterProp: 'label' }}
                            optionRender={option => (
                              <ColumnOption>
                                <span>{option.label}</span>
                                {option.value !== option.label && (
                                  <small>{option.value}</small>
                                )}
                              </ColumnOption>
                            )}
                          />
                        </Form.Item>
                        <EqualityMark aria-hidden="true">=</EqualityMark>
                        <Form.Item
                          {...field}
                          name={[field.name, 'rightColumn']}
                          label={t('rightColumn')}
                          rules={[{ required: true }]}
                        >
                          <Select
                            options={rightColumns}
                            disabled={!rightId}
                            placeholder={t(
                              rightId ? 'selectField' : 'chooseRightViewFirst',
                            )}
                            showSearch={{ optionFilterProp: 'label' }}
                            optionRender={option => (
                              <ColumnOption>
                                <span>{option.label}</span>
                                {option.value !== option.label && (
                                  <small>{option.value}</small>
                                )}
                              </ColumnOption>
                            )}
                          />
                        </Form.Item>
                      </ConditionFields>
                    </ConditionRow>
                  ))}
                  <Button
                    ref={addConditionRef}
                    type="dashed"
                    htmlType="button"
                    icon={<PlusOutlined aria-hidden="true" />}
                    onClick={() => add()}
                  >
                    {t('addCondition')}
                  </Button>
                </>
              )}
            </Form.List>
          </FormSection>
          <ActionBar>
            <Button
              type="primary"
              htmlType="button"
              loading={loading}
              onClick={generate}
            >
              {t('generate')}
            </Button>
            {generated && (
              <Button htmlType="button" onClick={saveGeneratedView}>
                {t('save')}
              </Button>
            )}
          </ActionBar>
        </Form>
      </Content>
      <Modal
        title={t('previewTitle')}
        open={previewVisible}
        width={1040}
        style={{ maxWidth: 'calc(100vw - 32px)' }}
        onCancel={() => setPreviewVisible(false)}
        footer={
          <PreviewFooter>
            <Button onClick={() => setPreviewVisible(false)}>
              {t('back')}
            </Button>
            <PreviewActions>
              <Button onClick={applyGeneratedSql}>{t('openEditor')}</Button>
              <Button onClick={saveGeneratedView}>{t('save')}</Button>
              <Button type="primary" onClick={executeGeneratedSql}>
                {t('execute')}
              </Button>
            </PreviewActions>
          </PreviewFooter>
        }
      >
        <PreviewHelp id={`${builderId}-preview-help`}>
          {t('previewHelp')}
        </PreviewHelp>
        <PreviewSql
          aria-label={t('generatedSql')}
          aria-describedby={`${builderId}-preview-help`}
          value={generated?.script}
          readOnly
          autoSize={{ minRows: 12, maxRows: 24 }}
        />
      </Modal>
    </Wrapper>
  );
});

const Wrapper = styled.div`
  flex: 1;
  min-width: 0;
  padding: ${SPACE_LG};
  overflow: auto;
  container-type: inline-size;

  .ant-alert {
    margin-bottom: ${SPACE_MD};
  }

  .ant-btn:focus-visible {
    outline: 2px solid ${p => p.theme.primary};
    outline-offset: 2px;
  }
`;

const Content = styled.div`
  width: 100%;
  max-width: 1040px;
  margin-inline: auto;
`;

const Header = styled.header`
  margin-bottom: ${SPACE_LG};

  h2 {
    margin: 0 0 ${SPACE_XS};
    font-size: 20px;
    font-weight: 600;
    line-height: 1.4;
  }
`;

const Description = styled.p`
  margin: 0;
  color: ${p => p.theme.textColorSnd};
  line-height: 1.6;
`;

const FormSection = styled.section`
  min-width: 0;
  margin-bottom: ${SPACE_LG};
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${SPACE_XS};
  margin-bottom: ${SPACE_MD};

  h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }
`;

const StepNumber = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: ${p => p.theme.textColorSnd};
  border: 1px solid ${p => p.theme.borderColorSplit};
  border-radius: 50%;
  font-size: 12px;
`;

const SectionHint = styled.p`
  margin: 0 0 ${SPACE_MD};
  color: ${p => p.theme.textColorSnd};
  line-height: 1.6;
`;

const ViewRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(140px, 0.6fr) minmax(0, 1fr);
  gap: ${SPACE_MD};

  .ant-form-item {
    min-width: 0;
    margin-bottom: 0;
  }

  .ant-select {
    width: 100%;
  }

  @container (max-width: 680px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const ConditionRow = styled.div`
  min-width: 0;
  padding: ${SPACE_MD};
  margin-bottom: ${SPACE_MD};
  border: 1px solid ${p => p.theme.borderColorSplit};
  border-radius: 4px;
`;

const ConditionHeading = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${SPACE_XS};
  min-height: 32px;
  margin-bottom: ${SPACE_XS};

  h4 {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
  }
`;

const ConditionFields = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 20px minmax(0, 1fr);
  gap: ${SPACE_XS};
  align-items: start;

  .ant-form-item {
    min-width: 0;
    margin-bottom: 0;
  }

  .ant-select {
    width: 100%;
  }

  @container (max-width: 560px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const EqualityMark = styled.span`
  padding-top: 34px;
  color: ${p => p.theme.textColorSnd};
  font-size: 16px;
  text-align: center;

  @container (max-width: 560px) {
    padding-top: 0;
  }
`;

const ColumnOption = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;

  span,
  small {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  small {
    color: ${p => p.theme.textColorSnd};
  }
`;

const ActionBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${SPACE_XS};
  padding-top: ${SPACE_MD};
  border-top: 1px solid ${p => p.theme.borderColorSplit};
`;

const PreviewHelp = styled.p`
  margin-bottom: ${SPACE_MD};
  color: ${p => p.theme.textColorSnd};
  line-height: 1.6;
`;

const PreviewSql = styled(Input.TextArea)`
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 12px;
  line-height: 1.65;
`;

const PreviewFooter = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${SPACE_XS} ${SPACE_MD};

  .ant-btn:focus-visible {
    outline: 2px solid ${p => p.theme.primary};
    outline-offset: 2px;
  }
`;

const PreviewActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${SPACE_XS};
`;
