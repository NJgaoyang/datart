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

import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Form, Input } from 'antd';
import usePrefixI18N from 'app/hooks/useI18NPrefix';
import { User } from 'app/slice/types';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import { getToken } from 'utils/auth';

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

interface LoginFormProps {
  loading: boolean;
  loggedInUser?: User | null;
  registerEnable?: boolean;
  inShare?: boolean;
  onLogin?: (value) => void;
}

export function LoginFormLight({
  loading,
  loggedInUser,
  registerEnable = true,
  inShare = false,
  onLogin,
}: LoginFormProps) {
  const [switchUser, setSwitchUser] = useState(false);
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const logged = !!getToken();
  const t = usePrefixI18N('login');
  const tg = usePrefixI18N('global');

  const toApp = useCallback(() => {
    navigate('/', { replace: true });
  }, [navigate]);

  const onSwitch = useCallback(() => {
    setSwitchUser(true);
  }, []);

  return (
    <FormWrapper>
      {logged && !switchUser && !inShare ? (
        <LoggedInPanel>
          <LoggedInTitle>{t('alreadyLoggedIn')}</LoggedInTitle>
          <UserPanel onClick={toApp}>
            <UserAvatar>
              <UserOutlined />
            </UserAvatar>
            <UserInfo>
              <UserName>{loggedInUser?.username}</UserName>
              <EnterHint>{t('enter')}</EnterHint>
            </UserInfo>
          </UserPanel>
          <SwitchButton type="link" size="large" block onClick={onSwitch}>
            {t('switch')}
          </SwitchButton>
        </LoggedInPanel>
      ) : (
        <Form form={form} onFinish={onLogin}>
          <Form.Item
            name="username"
            rules={[
              {
                required: true,
                message: `${t('username')}${tg('validation.required')}`,
              },
            ]}
          >
            <StyledInput
              prefix={<UserOutlined />}
              placeholder={t('username')}
              aria-label={t('username')}
              size="large"
            />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[
              {
                required: true,
                message: `${t('password')}${tg('validation.required')}`,
              },
            ]}
          >
            <StyledInput
              prefix={<LockOutlined />}
              placeholder={t('password')}
              aria-label={t('password')}
              type="password"
              size="large"
            />
          </Form.Item>
          <Form.Item className="last" shouldUpdate>
            {() => (
              <LoginButton
                type="primary"
                htmlType="submit"
                size="large"
                loading={loading}
                disabled={
                  loading ||
                  !!form.getFieldsError().filter(({ errors }) => errors.length)
                    .length
                }
                block
              >
                {loading ? '登录中...' : t('login')}
              </LoginButton>
            )}
          </Form.Item>

          <AdminTip>新增用户请联系管理员</AdminTip>
        </Form>
      )}
    </FormWrapper>
  );
}

// ============ 样式 ============

const FormWrapper = styled.div`
  width: 100%;
`;

const LoggedInPanel = styled.div`
  animation: ${fadeInUp} 0.5s ease-out;
`;

const LoggedInTitle = styled.h3`
  font-size: clamp(16px, 1.3vw, 21px);
  font-weight: 600;
  color: #1e293b;
  text-align: center;
  margin-bottom: clamp(14px, 1.8vh, 24px);
`;

const UserPanel = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(12px, 1vw, 18px);
  padding: clamp(16px, 1.4vw, 24px);
  background: #f8fafc;
  border-radius: clamp(12px, 1vw, 18px);
  border: 1px solid #e2e8f0;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-bottom: clamp(12px, 1.5vh, 20px);

  &:hover {
    background: #eff6ff;
    transform: translateY(-2px);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1),
      0 2px 4px -2px rgba(0, 0, 0, 0.1);
    border-color: #bfdbfe;
  }
`;

const UserAvatar = styled.div`
  width: clamp(42px, 3.2vw, 56px);
  height: clamp(42px, 3.2vw, 56px);
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border-radius: clamp(12px, 1vw, 16px);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(16px, 1.4vw, 22px);
  color: white;
`;

const UserInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const UserName = styled.p`
  font-size: clamp(15px, 1.05vw, 18px);
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 3px;
`;

const EnterHint = styled.p`
  font-size: clamp(12px, 0.8vw, 14px);
  color: #64748b;
  margin: 0;
`;

const SwitchButton = styled(Button)`
  color: #64748b !important;
  font-size: clamp(13px, 0.9vw, 15px);

  &:hover {
    color: #3b82f6 !important;
  }
`;

const StyledInput = styled(Input)`
  height: clamp(46px, 4vw, 60px) !important;
  background: #f8fafc !important;
  border: 1px solid #e2e8f0 !important;
  border-radius: clamp(12px, 1vw, 16px) !important;
  transition: all 0.3s ease;

  &:hover,
  &:focus,
  &.ant-input-affix-wrapper-focused {
    background: #ffffff !important;
    border-color: #3b82f6 !important;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2) !important;
  }

  .ant-input {
    background: transparent !important;
    color: #1e293b !important;
    font-size: clamp(14px, 1vw, 17px);

    &::placeholder {
      color: #94a3b8 !important;
    }
  }

  .ant-input-prefix {
    color: #64748b !important;
    margin-right: clamp(10px, 0.7vw, 14px);
    font-size: clamp(16px, 1.2vw, 20px);
  }
`;

const LoginButton = styled(Button)`
  height: clamp(46px, 4vw, 60px) !important;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
  border: none !important;
  border-radius: clamp(12px, 1vw, 16px) !important;
  font-size: clamp(16px, 1.1vw, 19px) !important;
  font-weight: 600 !important;
  box-shadow: 0 10px 30px rgba(37, 99, 235, 0.3) !important;
  transition: all 0.3s ease !important;

  &:hover:not(:disabled) {
    transform: translateY(-2px) !important;
    box-shadow: 0 15px 40px rgba(37, 99, 235, 0.4) !important;
  }

  &:active:not(:disabled) {
    transform: translateY(0) !important;
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

const AdminTip = styled.p`
  text-align: center;
  font-size: clamp(12px, 0.8vw, 14px);
  color: #64748b;
  margin: clamp(12px, 1.5vh, 20px) 0 0;
`;
