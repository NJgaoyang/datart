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

import { Tooltip } from 'antd';
import { memo, ReactElement, useCallback, useState } from 'react';
import useI18NPrefix from 'app/hooks/useI18NPrefix';
import styled from 'styled-components';

interface TabProps {
  name: string;
  title: string;
  shortTitle?: string;
  icon?: ReactElement;
}

interface VerticalTabsProps {
  tabs: TabProps[];
  onSelect?: (key: string) => void;
}

export const VerticalTabs = memo(({ tabs, onSelect }: VerticalTabsProps) => {
  const [selectedTab, setSelectedTab] = useState('');
  const t = useI18NPrefix('view.properties');

  const selectTab = useCallback(
    (name: string) => {
      const nextTab = name === selectedTab ? '' : name;
      setSelectedTab(nextTab);
      onSelect?.(nextTab);
    },
    [selectedTab, onSelect],
  );

  return (
    <Wrapper role="group" aria-label={t('tools')}>
      {tabs.map(({ name, title, shortTitle, icon }) => (
        <Tooltip title={title} placement="left" key={name}>
          <Tab
            type="button"
            aria-label={title}
            aria-pressed={selectedTab === name}
            onClick={() => selectTab(name)}
          >
            <span className="tab-icon" aria-hidden="true">{icon}</span>
            <span className="tab-label">{shortTitle || title}</span>
          </Tab>
        </Tooltip>
      ))}
    </Wrapper>
  );
});

const Wrapper = styled.div`
  display: flex;
  flex: none;
  flex-direction: column;
  gap: 4px;
  width: 56px;
  padding: 6px 4px;
  background-color: ${p => p.theme.bodyBackground};
  border-left: 1px solid ${p => p.theme.borderColorSplit};
`;

const Tab = styled.button`
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 58px;
  width: 100%;
  padding: 6px 2px;
  color: ${p => p.theme.textColorSnd};
  font: inherit;
  cursor: pointer;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;

  .tab-icon { font-size: 17px; line-height: 20px; }
  .tab-label { font-size: 12px; line-height: 16px; }

  &:hover {
    color: ${p => p.theme.primary};
    background-color: ${p => p.theme.componentBackground};
  }

  &[aria-pressed='true'] {
    color: ${p => p.theme.primary};
    background-color: ${p => p.theme.componentBackground};
    border-color: ${p => p.theme.borderColorBase};
    box-shadow: inset 2px 0 0 ${p => p.theme.primary};
  }

  &:focus-visible {
    outline: 2px solid ${p => p.theme.primary};
    outline-offset: 1px;
  }
`;
