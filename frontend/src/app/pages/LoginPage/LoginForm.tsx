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
import { StorageKeys } from 'globalConstants';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import { getToken } from 'utils/auth';
import persistence from 'utils/persistence';
import { AUTH_CLIENT_ICON_MAPPING } from './constants';

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

interface LoginFormProps {
  loading: boolean;
  loggedInUser?: User | null;
  oauth2Clients: Array<{ name: string; value: string }>;
  registerEnable?: boolean;
  inShare?: boolean;
  onLogin?: (value) => void;
}

export function LoginForm({
  loading,
  loggedInUser,
  oauth2Clients,
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

  const toAuthClient = useCallback(
    clientUrl => () => {
      if (inShare) {
        persistence.session.save(
          StorageKeys.AuthRedirectUrl,
          window.location.href,
        );
      }
      window.location.href = clientUrl;
    },
    [inShare],
  );

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

          {oauth2Clients.length > 0 && (
            <OAuthSection>
              <DividerLine>
                <DividerText>{t('authTitle')}</DividerText>
              </DividerLine>
              {oauth2Clients.map(({ name, value }) => (
                <OAuthButton
                  key={value}
                  size="large"
                  icon={AUTH_CLIENT_ICON_MAPPING[name.toLowerCase()]}
                  onClick={toAuthClient(value)}
                  block
                >
                  {name}
                </OAuthButton>
              ))}
            </OAuthSection>
          )}
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
  font-size: clamp(14px, 1.1vw, 18px);
  font-weight: 600;
  color: #fff;
  text-align: center;
  margin-bottom: clamp(12px, 1.5vh, 20px);
`;

const UserPanel = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(10px, 0.8vw, 16px);
  padding: clamp(14px, 1.2vw, 20px);
  background: rgba(255, 255, 255, 0.15);
  border-radius: clamp(10px, 0.8vw, 16px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  cursor: pointer;
  transition: all 0.3s ease;
  margin-bottom: clamp(10px, 1.2vh, 16px);

  &:hover {
    background: rgba(255, 255, 255, 0.22);
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
  }
`;

const UserAvatar = styled.div`
  width: clamp(36px, 2.8vw, 48px);
  height: clamp(36px, 2.8vw, 48px);
  background: linear-gradient(135deg, #818cf8 0%, #a78bfa 100%);
  border-radius: clamp(10px, 0.8vw, 14px);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(14px, 1.2vw, 20px);
  color: white;
`;

const UserInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const UserName = styled.p`
  font-size: clamp(13px, 0.9vw, 16px);
  font-weight: 600;
  color: #fff;
  margin: 0 0 2px;
`;

const EnterHint = styled.p`
  font-size: clamp(11px, 0.75vw, 13px);
  color: rgba(255, 255, 255, 0.6);
  margin: 0;
`;

const SwitchButton = styled(Button)`
  color: rgba(255, 255, 255, 0.7) !important;
  font-size: clamp(12px, 0.8vw, 14px);

  &:hover {
    color: #fff !important;
  }
`;

const StyledInput = styled(Input)`
  height: clamp(40px, 3.5vw, 52px) !important;
  background: rgba(255, 255, 255, 0.15) !important;
  border: 1px solid rgba(255, 255, 255, 0.25) !important;
  border-radius: clamp(10px, 0.8vw, 14px) !important;
  transition: all 0.3s ease;

  &:hover,
  &:focus,
  &.ant-input-affix-wrapper-focused {
    background: rgba(255, 255, 255, 0.22) !important;
    border-color: #818cf8 !important;
    box-shadow: 0 0 0 3px rgba(129, 140, 248, 0.3) !important;
  }

  .ant-input {
    background: transparent !important;
    color: #fff !important;
    font-size: clamp(13px, 0.85vw, 15px);

    &::placeholder {
      color: rgba(255, 255, 255, 0.6) !important;
    }
  }

  .ant-input-prefix {
    color: rgba(255, 255, 255, 0.7) !important;
    margin-right: clamp(8px, 0.6vw, 12px);
    font-size: clamp(14px, 1vw, 18px);
  }
`;

const LoginButton = styled(Button)`
  height: clamp(40px, 3.5vw, 52px) !important;
  background: linear-gradient(135deg, #818cf8 0%, #a78bfa 100%) !important;
  border: none !important;
  border-radius: clamp(10px, 0.8vw, 14px) !important;
  font-size: clamp(14px, 0.9vw, 16px) !important;
  font-weight: 600 !important;
  box-shadow: 0 10px 30px rgba(99, 102, 241, 0.4) !important;
  transition: all 0.3s ease !important;

  &:hover:not(:disabled) {
    transform: translateY(-2px) !important;
    box-shadow: 0 15px 40px rgba(99, 102, 241, 0.5) !important;
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
  font-size: clamp(11px, 0.75vw, 13px);
  color: rgba(255, 255, 255, 0.6);
  margin: clamp(10px, 1.2vh, 16px) 0 0;
`;

const OAuthSection = styled.div`
  margin-top: clamp(16px, 2vh, 24px);
`;

const DividerLine = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: clamp(10px, 1.2vh, 16px);

  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: rgba(255, 255, 255, 0.15);
  }
`;

const DividerText = styled.span`
  padding: 0 clamp(10px, 0.8vw, 16px);
  font-size: clamp(11px, 0.75vw, 13px);
  color: rgba(255, 255, 255, 0.5);
`;

const OAuthButton = styled(Button)`
  height: clamp(36px, 2.8vw, 48px) !important;
  background: rgba(255, 255, 255, 0.15) !important;
  border: 1px solid rgba(255, 255, 255, 0.25) !important;
  border-radius: clamp(8px, 0.7vw, 12px) !important;
  color: #fff !important;
  font-size: clamp(12px, 0.8vw, 14px) !important;
  margin-bottom: clamp(6px, 0.6vh, 10px) !important;
  transition: all 0.3s ease !important;

  &:hover {
    background: rgba(255, 255, 255, 0.22) !important;
    border-color: #818cf8 !important;
    transform: translateY(-1px) !important;
  }

  &:last-child {
    margin-bottom: 0 !important;
  }
`;
