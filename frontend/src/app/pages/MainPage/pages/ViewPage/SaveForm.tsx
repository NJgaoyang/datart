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

import { DownOutlined } from '@ant-design/icons';
import {
  Button,
  Checkbox,
  Form,
  FormInstance,
  Input,
  InputNumber,
  Radio,
  Switch,
  TreeSelect,
} from 'antd';
import { ModalForm, ModalFormProps } from 'app/components';
import { APP_CURRENT_VERSION } from 'app/configVersion';
import useI18NPrefix from 'app/hooks/useI18NPrefix';

import { fetchCheckName } from 'app/utils/fetch';
import debounce from 'debounce-promise';
import { DEFAULT_DEBOUNCE_WAIT } from 'globalConstants';
import {
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';
import { SPACE_MD, SPACE_XS } from 'styles/StyleConstants';
import { getCascadeAccess } from '../../Access';
import {
  selectIsOrgOwner,
  selectModuleAccessMap,
  selectOrgId,
  selectPermissionMap,
} from '../../slice/selectors';
import { PermissionLevels, ResourceTypes } from '../PermissionPage/constants';
import { ConcurrencyControlModes, ViewViewModelStages } from './constants';
import { SaveFormContext } from './SaveFormContext';
import {
  makeSelectViewFolderTree,
  selectCurrentEditingView,
} from './slice/selectors';

type SaveFormProps = Omit<ModalFormProps, 'type' | 'open' | 'onSave'>;

export function SaveForm({ formProps, ...modalProps }: SaveFormProps) {
  const [advancedVisible, setAdvancedVisible] = useState(false);
  const formId = useId();
  const selectViewFolderTree = useMemo(makeSelectViewFolderTree, []);
  const {
    type,
    open,
    simple,
    parentIdLabel,
    initialValues,
    onSave,
    onCancel,
    onAfterClose,
  } = useContext(SaveFormContext);
  const isOwner = useSelector(selectIsOrgOwner);
  const permissionMap = useSelector(selectPermissionMap);
  const moduleAccessMap = useSelector(selectModuleAccessMap);

  const getDisabled = useCallback(
    (_, path: string[]) =>
      !getCascadeAccess(
        isOwner,
        permissionMap,
        moduleAccessMap,
        ResourceTypes.View,
        path,
        PermissionLevels.Create,
      ),
    [isOwner, permissionMap, moduleAccessMap],
  );

  const folderTree = useSelector(state =>
    selectViewFolderTree(state, { id: initialValues?.id, getDisabled }),
  );
  const currentEditingView = useSelector(selectCurrentEditingView);
  const orgId = useSelector(selectOrgId);
  const formRef = useRef<FormInstance>(undefined);
  const t = useI18NPrefix('view.saveForm');
  const tg = useI18NPrefix('global');

  useEffect(() => {
    if (initialValues) {
      formRef.current?.setFieldsValue({
        ...initialValues,
        parentId: initialValues.parentId || void 0,
      });
    }
  }, [initialValues]);

  const toggleAdvanced = useCallback(() => {
    setAdvancedVisible(visible => !visible);
  }, []);

  const save = useCallback(
    values => {
      onSave(
        {
          ...values,
          config: { version: APP_CURRENT_VERSION, ...values.config },
        },
        onCancel,
      );
    },
    [onSave, onCancel],
  );

  const afterClose = useCallback(() => {
    formRef.current?.resetFields();
    setAdvancedVisible(false);
    onAfterClose && onAfterClose();
  }, [onAfterClose]);

  return (
    <ModalForm
      width={600}
      style={{ maxWidth: 'calc(100vw - 32px)' }}
      formProps={{
        ...formProps,
        layout: 'vertical',
        labelAlign: 'left',
        labelCol: { span: 24 },
        wrapperCol: { span: 24 },
        colon: false,
      }}
      {...modalProps}
      title={t(simple ? 'folder' : 'title')}
      type={type}
      open={open}
      confirmLoading={currentEditingView?.stage === ViewViewModelStages.Saving}
      onSave={save}
      onCancel={onCancel}
      afterClose={afterClose}
      ref={formRef}
    >
      <FormContent>
        <section aria-labelledby={simple ? undefined : `${formId}-basic`}>
          {!simple && (
            <SectionTitle id={`${formId}-basic`}>
              {t('basicInfo')}
            </SectionTitle>
          )}
          <Form.Item
            name="name"
            label={t('name')}
            getValueFromEvent={event => event.target.value?.trim()}
            rules={[
              {
                required: true,
                message: `${t('name')}${tg('validation.required')}`,
              },
              {
                validator: debounce((_, value) => {
                  if (!value || initialValues?.name === value) {
                    return Promise.resolve();
                  }
                  if (!value.trim()) {
                    return Promise.reject(
                      `${t('name')}${tg('validation.required')}`,
                    );
                  }
                  const parentId = formRef.current?.getFieldValue('parentId');
                  const data = {
                    name: value,
                    orgId,
                    parentId: parentId || null,
                  };
                  return fetchCheckName('views', data);
                }, DEFAULT_DEBOUNCE_WAIT),
              },
            ]}
          >
            <Input placeholder={t('namePlaceholder')} />
          </Form.Item>
          <Form.Item name="parentId" label={parentIdLabel}>
            <TreeSelect
              placeholder={t('root')}
              treeData={folderTree || []}
              allowClear
              onChange={() => {
                formRef.current?.validateFields();
              }}
            />
          </Form.Item>
        </section>
        {!simple && initialValues?.config && (
          <SettingsSection>
            <AdvancedToggle
              type="text"
              htmlType="button"
              id={`${formId}-advanced-toggle`}
              aria-expanded={advancedVisible}
              aria-controls={`${formId}-advanced`}
              aria-describedby={`${formId}-advanced-help`}
              onClick={toggleAdvanced}
            >
              {t('advanced')}
              <DownOutlined
                aria-hidden="true"
                rotate={advancedVisible ? 180 : 0}
              />
            </AdvancedToggle>
            <SectionHint id={`${formId}-advanced-help`}>
              {t('advancedDescription')}
            </SectionHint>
            <AdvancedWrapper
              id={`${formId}-advanced`}
              aria-labelledby={`${formId}-advanced-toggle`}
              hidden={!advancedVisible}
            >
              <AdvancedGrid>
                <Form.Item
                  name={['config', 'concurrencyControl']}
                  label={t('concurrencyControl')}
                  valuePropName="checked"
                  initialValue={true}
                >
                  <Switch />
                </Form.Item>
                <Form.Item
                  noStyle
                  shouldUpdate={(previous, current) =>
                    previous.config?.concurrencyControl !==
                    current.config?.concurrencyControl
                  }
                >
                  {({ getFieldValue }) => (
                    <Form.Item
                      name={['config', 'concurrencyControlMode']}
                      label={t('concurrencyControlMode')}
                      initialValue={ConcurrencyControlModes.DirtyRead}
                    >
                      <Radio.Group
                        disabled={
                          !getFieldValue(['config', 'concurrencyControl'])
                        }
                      >
                        {Object.values(ConcurrencyControlModes).map(value => (
                          <Radio key={value} value={value}>
                            {t(value.toLowerCase())}
                          </Radio>
                        ))}
                      </Radio.Group>
                    </Form.Item>
                  )}
                </Form.Item>
                <Form.Item
                  name={['config', 'cache']}
                  label={t('cache')}
                  valuePropName="checked"
                  initialValue={false}
                >
                  <Switch />
                </Form.Item>
                <Form.Item
                  noStyle
                  shouldUpdate={(previous, current) =>
                    previous.config?.cache !== current.config?.cache
                  }
                >
                  {({ getFieldValue }) => (
                    <Form.Item
                      name={['config', 'cacheExpires']}
                      label={t('cacheExpires')}
                      initialValue={0}
                    >
                      <InputNumber
                        disabled={!getFieldValue(['config', 'cache'])}
                        min={0}
                      />
                    </Form.Item>
                  )}
                </Form.Item>
                <WideSetting>
                  <Form.Item
                    name={['config', 'expensiveQuery']}
                    initialValue={false}
                    valuePropName="checked"
                  >
                    <Checkbox>{t('expensiveQuery')}</Checkbox>
                  </Form.Item>
                </WideSetting>
              </AdvancedGrid>
            </AdvancedWrapper>
          </SettingsSection>
        )}
      </FormContent>
    </ModalForm>
  );
}

const FormContent = styled.div`
  min-width: 0;

  .ant-form-item {
    margin-bottom: 20px;
  }

  .ant-input-number,
  .ant-select {
    width: 100%;
  }

  .ant-radio-group {
    display: flex;
    flex-wrap: wrap;
    gap: ${SPACE_XS};
  }

  .ant-btn:focus-visible {
    outline: 2px solid ${p => p.theme.primary};
    outline-offset: 2px;
  }
`;

const SectionTitle = styled.h3`
  margin: 0 0 ${SPACE_MD};
  color: ${p => p.theme.textColor};
  font-size: 14px;
  font-weight: 600;
`;

const SettingsSection = styled.section`
  padding-top: ${SPACE_XS};
  border-top: 1px solid ${p => p.theme.borderColorSplit};
`;

const AdvancedToggle = styled(Button)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding-inline: 0;
  color: ${p => p.theme.textColor};
  font-weight: 600;
  text-align: left;
`;

const SectionHint = styled.p`
  margin: ${SPACE_XS} 0 ${SPACE_MD};
  color: ${p => p.theme.textColorSnd};
  line-height: 1.6;
`;

const AdvancedWrapper = styled.div`
  &[hidden] {
    display: none;
  }
`;

const AdvancedGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 24px;

  > * {
    min-width: 0;
  }

  @media (max-width: 560px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const WideSetting = styled.div`
  grid-column: 1 / -1;

  .ant-form-item {
    margin-bottom: ${SPACE_MD};
  }
`;
