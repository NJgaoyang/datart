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

import { useSelector } from 'react-redux';
import { Button, Result, Spin } from 'antd';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from 'redux/hooks';
import { Navigate } from 'react-router-dom';
import { getToken } from 'utils/auth';
import { LazyMainPage } from './pages/MainPage/Loadable';
import { selectSystemInfo } from './slice/selectors';
import { getSystemInfo } from './slice/thunks';
import { RootState } from 'types';

export function LoginAuthRoute() {
  const logged = !!getToken();
  const systemInfo = useSelector(selectSystemInfo);
  const failed = useSelector((state: RootState) => state.app?.systemInfoFailed);
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  if (logged) {
    return <LazyMainPage />;
  }

  if (systemInfo) {
    return <Navigate to={systemInfo.initialized ? '/login' : '/setup'} replace />;
  }
  return failed ? (
    <Result status="error" title={t('global.systemInfoError')} extra={<Button type="primary" onClick={() => dispatch(getSystemInfo())}>{t('global.retry')}</Button>} />
  ) : <Spin fullscreen />;
}
