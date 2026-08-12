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

import { LoginFormLight } from 'app/pages/LoginPage/LoginFormLight';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { selectLoginLoading } from '../slice/selectors';

function ShareLoginModal({ visible, onChange }) {
  const dispatch = useDispatch();
  const loading = useSelector(selectLoginLoading);

  return (
    visible && (
      <LoginWrapper>
        <LoginFormLight loading={loading} inShare={true} onLogin={onChange} />
      </LoginWrapper>
    )
  );
}

export default ShareLoginModal;

const LoginWrapper = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  height: 100%;
  background: ${p => p.theme.bodyBackground};
`;
