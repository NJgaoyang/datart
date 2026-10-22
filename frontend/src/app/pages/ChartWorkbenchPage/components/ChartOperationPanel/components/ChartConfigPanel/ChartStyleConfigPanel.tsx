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

import { Collapse } from 'antd';
import { FormGroupLayoutMode } from 'app/components/FormGenerator/constants';
import GroupLayout from 'app/components/FormGenerator/Layout/GroupLayout';
import ItemLayout from 'app/components/FormGenerator/Layout/ItemLayout';
import useI18NPrefix from 'app/hooks/useI18NPrefix';
import { ChartDataConfig, ChartStyleConfig } from 'app/types/ChartConfig';
import { FC, memo } from 'react';

const ChartStyleConfigPanel: FC<{
  configs?: ChartStyleConfig[];
  dataConfigs?: ChartDataConfig[];
  i18nPrefix: string;
  context?: any;
  onChange: (
    ancestors: number[],
    config: ChartStyleConfig,
    needRefresh?: boolean,
  ) => void;
}> = memo(
  ({ configs, dataConfigs, i18nPrefix, context, onChange }) => {
    const t = useI18NPrefix(i18nPrefix);

    return (
      <div className="datart-config-panel">
        {configs
          ?.filter(c => !Boolean(c.hidden))
          ?.map((c, index) => {
            if (c.comType === 'group') {
              return (
                <Collapse
                  key={c.key}
                  ghost
                  items={[
                    {
                      key: c.key,
                      label: t(c.label, true),
                      children: (
                        <GroupLayout
                          ancestors={[index]}
                          mode={
                            c.comType === 'group'
                              ? FormGroupLayoutMode.INNER
                              : FormGroupLayoutMode.OUTER
                          }
                          data={c}
                          translate={t}
                          dataConfigs={dataConfigs}
                          onChange={onChange}
                          context={context}
                          flatten
                        />
                      ),
                    },
                  ]}
                />
              );
            } else {
              return (
                <ItemLayout
                  ancestors={[index]}
                  data={c}
                  translate={t}
                  dataConfigs={dataConfigs}
                  onChange={onChange}
                  context={context}
                />
              );
            }
          })}
      </div>
    );
  },
  (prev, next) =>
    prev.configs === next.configs && prev.dataConfigs === next.dataConfigs,
);

export default ChartStyleConfigPanel;
