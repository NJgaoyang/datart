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

import { LoadingOutlined } from '@ant-design/icons';
import { Alert, Spin } from 'antd';
import { useFrame } from 'app/components/ReactFrameComponent';
import { ChartLifecycle } from 'app/constants';
import usePrefixI18N from 'app/hooks/useI18NPrefix';
import { IChart } from 'app/types/Chart';
import { ChartConfig, SelectedItem } from 'app/types/ChartConfig';
import { IChartDrillOption } from 'app/types/ChartDrillOption';
import { BrokerContext, BrokerOption } from 'app/types/ChartLifecycleBroker';
import {
  CSSProperties,
  FC,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import styled from 'styled-components';
import { uuidv4 } from 'utils/utils';
import ChartIFrameEventBroker from './ChartIFrameEventBroker';
import ChartIFrameResourceLoader from './ChartIFrameResourceLoader';

enum ContainerStatus {
  INIT,
  SUCCESS,
  FAILED,
  LOADING,
}

const ChartIFrameLifecycleAdapter: FC<{
  dataset: any;
  chart: IChart;
  config: ChartConfig;
  style: CSSProperties;
  isShown?: boolean;
  drillOption?: IChartDrillOption;
  selectedItems?: SelectedItem[];
  widgetSpecialConfig?: any;
  isLoadingData?: boolean;
}> = ({
  dataset,
  chart,
  config,
  style,
  isShown = true,
  drillOption,
  selectedItems,
  widgetSpecialConfig,
  isLoadingData = false,
}) => {
  const [chartResourceLoader] = useState(() => new ChartIFrameResourceLoader());
  const eventBrokerRef = useRef<ChartIFrameEventBroker>(undefined);
  const [containerStatus, setContainerStatus] = useState(ContainerStatus.INIT);
  const [loadFailed, setLoadFailed] = useState(false);
  const { document, window } = useFrame();
  const [containerId] = useState(() => `datart-${uuidv4()}`);
  const translator = usePrefixI18N();

  const buildBrokerOption = useCallback(() => {
    return {
      containerId,
      dataset,
      config,
      widgetSpecialConfig,
      drillOption,
      selectedItems,
    } as BrokerOption;
  }, [
    config,
    containerId,
    dataset,
    drillOption,
    selectedItems,
    widgetSpecialConfig,
  ]);

  const buildBrokerContext = useCallback(() => {
    return {
      document,
      window,
      width: style?.width,
      height: style?.height,
      translator,
    } as BrokerContext;
  }, [document, style?.height, style?.width, translator, window]);

  // An external chart plugin can finish loading after its React 19 mount was
  // cleaned up; never mount into a stale iframe or dispose a newer broker.
  useEffect(() => {
    if (!isShown || !chart || !document || !window || !config) return;
    let cancelled = false;
    setContainerStatus(ContainerStatus.LOADING);
    setLoadFailed(false);

    chartResourceLoader.loadResource(document, chart.getDependencies?.())
      .then(() => {
        if (cancelled) return;
        chart.init(config);
        const broker = new ChartIFrameEventBroker();
        broker.register(chart);
        broker.publish(
          ChartLifecycle.Mounted,
          buildBrokerOption(),
          buildBrokerContext(),
        );
        eventBrokerRef.current = broker;
        setContainerStatus(ContainerStatus.SUCCESS);
      })
      .catch(error => {
        if (cancelled) return;
        // Preserve the underlying error for diagnostics, not for end users.
        console.error('Datart chart initialization failed:', chart.meta?.id, error);
        setLoadFailed(true);
        setContainerStatus(ContainerStatus.FAILED);
      });

    return () => {
      cancelled = true;
      const broker = eventBrokerRef.current;
      eventBrokerRef.current = undefined;
      if (broker) {
        broker.publish(
          ChartLifecycle.UnMount,
          buildBrokerOption(),
          buildBrokerContext(),
        );
        broker.dispose();
      }
    };
    // The separate update effect applies new dataset/config without remounting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart?.meta?.id, isShown, document, window]);

  /**
   * Chart Resize Event
   * Dependency: 'style.width', 'style.height', 'document', 'window', 'isShown'
   */
  useEffect(() => {
    if (
      !isShown ||
      !document ||
      !window ||
      !config ||
      !dataset ||
      isLoadingData ||
      containerStatus !== ContainerStatus.SUCCESS
    ) {
      return;
    }

    eventBrokerRef.current?.publish(
      ChartLifecycle.Resize,
      buildBrokerOption(),
      buildBrokerContext(),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    style.width,
    style.height,
    document,
    window,
    isShown,
    containerStatus,
    isLoadingData,
  ]);

  /**
   * Chart Update Event
   * Dependency: 'config', 'dataset', 'widgetSpecialConfig',
   * 'containerStatus', 'document', 'window', 'isShown', 'drillOption', 'selectedItems'
   */
  useEffect(() => {
    if (
      !isShown ||
      !document ||
      !window ||
      !config ||
      !dataset ||
      isLoadingData ||
      containerStatus !== ContainerStatus.SUCCESS
    ) {
      return;
    }
    eventBrokerRef.current?.publish(
      ChartLifecycle.Updated,
      buildBrokerOption(),
      buildBrokerContext(),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    config,
    dataset,
    widgetSpecialConfig,
    containerStatus,
    document,
    window,
    isShown,
    drillOption,
    selectedItems,
    isLoadingData,
  ]);

  return (
    <Spin
      spinning={containerStatus === ContainerStatus.LOADING}
      indicator={<LoadingOutlined spin />}
      delay={500}
    >
      {loadFailed && (
        <Alert
          type="error"
          showIcon
          message="图表组件初始化失败"
          description="请刷新页面重试；如问题持续，请联系管理员检查浏览器控制台。"
        />
      )}
      <StyledChartLifecycleAdapter
        id={containerId}
        style={{ width: style?.width, height: style?.height }}
      />
    </Spin>
  );
};

export default ChartIFrameLifecycleAdapter;

const StyledChartLifecycleAdapter = styled.div``;
