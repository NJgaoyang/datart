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

import ChartIFrameEventBroker from '../ChartIFrameEventBroker';
import { vi } from 'vitest';
import { ChartLifecycle } from 'app/constants';
import type { IChart } from 'app/types/Chart';
import type { BrokerContext, BrokerLifecycleEvent, BrokerOption } from 'app/types/ChartLifecycleBroker';

describe('ChartIFrameEventBroker Tests', () => {
  let broker: ChartIFrameEventBroker;
  let mockOptions: BrokerOption;
  let mockContext: BrokerContext;
  beforeEach(() => {
    mockOptions = { dataset: [], chartConfig: {} } as unknown as BrokerOption;
    mockContext = {
      window: {},
      document: {},
      width: 100,
      height: 100,
    } as unknown as BrokerContext;
    broker = new ChartIFrameEventBroker();
  });

  test('should register chart lifecycle event correctly', () => {
    const chart = {
      onMount: vi.fn(),
      onUpdated: vi.fn(),
      onResize: vi.fn(),
      onUnMount: vi.fn(),
    };
    broker.register(chart as unknown as IChart);
    expect(broker['_chart']).toEqual(chart);
    expect(broker['_listeners'].get(ChartLifecycle.Mounted)).toEqual(chart.onMount);
    expect(broker['_listeners'].get(ChartLifecycle.Updated)).toEqual(chart.onUpdated);
    expect(broker['_listeners'].get(ChartLifecycle.Resize)).toEqual(chart.onResize);
    expect(broker['_listeners'].get(ChartLifecycle.UnMount)).toEqual(chart.onUnMount);
  });

  test('should subscribe chart lifecycle event standalone', () => {
    const mountFn = vi.fn();
    broker.subscribe(ChartLifecycle.Mounted, mountFn);
    expect(broker['_listeners'].get(ChartLifecycle.Mounted)).toEqual(mountFn);
  });

  test('should call chart onMount lifecycle when mounted', () => {
    const chart = {
      onMount: vi.fn(),
    };
    broker.register(chart as unknown as IChart);
    broker.publish(ChartLifecycle.Mounted, mockOptions, mockContext);
    expect(chart.onMount).toHaveBeenCalledTimes(1);
    expect(chart.onMount).toHaveBeenCalledWith(mockOptions, mockContext);
  });

  test('should call chart onUpdated lifecycle after mounted', async () => {
    const chart = {
      state: 'ready',
      onUpdated: vi.fn(),
    };
    broker.register(chart as unknown as IChart);
    broker.publish(ChartLifecycle.Updated, mockOptions, mockContext);

    // NOTE: the milliseconds is from EVENT_ACTION_DELAY_MS
    await new Promise(r => setTimeout(r, 300));
    expect(chart.onUpdated).toHaveBeenCalledTimes(1);
    expect(chart.onUpdated).toHaveBeenCalledWith(mockOptions, mockContext);
  });

  test('should invoke once onUpdated lifecycle with many update events', async () => {
    const chart = {
      state: 'ready',
      onUpdated: vi.fn(),
    };
    broker.register(chart as unknown as IChart);
    broker.publish(ChartLifecycle.Updated, mockOptions, mockContext);
    broker.publish(ChartLifecycle.Updated, mockOptions, mockContext);
    broker.publish(ChartLifecycle.Updated, mockOptions, mockContext);

    // NOTE: the milliseconds is from EVENT_ACTION_DELAY_MS
    await new Promise(r => setTimeout(r, 300));
    expect(chart.onUpdated).toHaveBeenCalledTimes(1);
    expect(chart.onUpdated).toHaveBeenCalledWith(mockOptions, mockContext);
  });

  test('should not call chart onUpdated lifecycle before mounted', () => {
    const chart = {
      onUpdated: vi.fn(),
    };
    broker.register(chart as unknown as IChart);
    broker.publish(ChartLifecycle.Updated, mockOptions, mockContext);
    expect(chart.onUpdated).toHaveBeenCalledTimes(0);
  });

  test('should call chart onResize lifecycle after mounted', async () => {
    const chart = {
      state: 'ready',
      onResize: vi.fn(),
    };
    broker.register(chart as unknown as IChart);
    broker.publish(ChartLifecycle.Resize, mockOptions, mockContext);

    // NOTE: the milliseconds is from EVENT_ACTION_DELAY_MS
    await new Promise(r => setTimeout(r, 300));
    expect(chart.onResize).toHaveBeenCalledTimes(1);
    expect(chart.onResize).toHaveBeenCalledWith(mockOptions, mockContext);
  });

  test('should invoke once onResize lifecycle with many resize events', async () => {
    const chart = {
      state: 'ready',
      onResize: vi.fn(),
    };
    broker.register(chart as unknown as IChart);
    broker.publish(ChartLifecycle.Resize, mockOptions, mockContext);
    broker.publish(ChartLifecycle.Resize, mockOptions, mockContext);
    broker.publish(ChartLifecycle.Resize, mockOptions, mockContext);

    // NOTE: the milliseconds is from EVENT_ACTION_DELAY_MS
    await new Promise(r => setTimeout(r, 300));
    expect(chart.onResize).toHaveBeenCalledTimes(1);
    expect(chart.onResize).toHaveBeenCalledWith(mockOptions, mockContext);
  });

  test('should not call chart onResize lifecycle before mounted', () => {
    const chart = {
      onResize: vi.fn(),
    };
    broker.register(chart as unknown as IChart);
    broker.publish(ChartLifecycle.Resize, mockOptions, mockContext);
    expect(chart.onResize).toHaveBeenCalledTimes(0);
  });

  test('should call chart onUnMount lifecycle after mounted', () => {
    const chart = {
      state: 'ready',
      onUnMount: vi.fn(),
    };
    broker.register(chart as unknown as IChart);
    broker.publish(ChartLifecycle.UnMount, mockOptions, mockContext);
    expect(chart.onUnMount).toHaveBeenCalledTimes(1);
    expect(chart.onUnMount).toHaveBeenCalledWith(mockOptions, mockContext);
  });

  test('should not call chart onUnMount lifecycle before mounted', () => {
    const chart = {
      onUnMount: vi.fn(),
    };
    broker.register(chart as unknown as IChart);
    broker.publish(ChartLifecycle.UnMount, mockOptions, mockContext);
    expect(chart.onUnMount).toHaveBeenCalledTimes(0);
  });

  test('should not call event when event name is not correct', () => {
    const chart = {
      state: 'mounting',
      onUnMount: vi.fn(),
    };
    broker.register(chart as unknown as IChart);
    broker.publish('unknown' as BrokerLifecycleEvent, mockOptions, mockContext);
    expect(chart.onUnMount).toHaveBeenCalledTimes(0);
  });

  test('should not call event after disposed', () => {
    const chart = {
      state: 'mounting',
      onUnMount: vi.fn(),
    };
    broker.register(chart as unknown as IChart);
    broker.dispose();
    broker.publish('unknown' as BrokerLifecycleEvent, mockOptions, mockContext);
    expect(chart.onUnMount).toHaveBeenCalledTimes(0);
  });

  test('should set state to ready after mounted', () => {
    const chart = {
      state: '',
      onMount: vi.fn(),
    };
    broker.register(chart as unknown as IChart);
    broker.publish(ChartLifecycle.Mounted, mockOptions, mockContext);
    expect(chart.onMount).toHaveBeenCalledTimes(1);
    expect(chart.state).toEqual('ready');
  });

  test('should set state to ready after updated', async () => {
    const chart = {
      state: 'ready',
      onUpdated: vi.fn(),
    };
    broker.register(chart as unknown as IChart);
    broker.publish(ChartLifecycle.Updated, mockOptions, mockContext);

    // NOTE: the milliseconds is from EVENT_ACTION_DELAY_MS
    await new Promise(r => setTimeout(r, 300));
    expect(chart.onUpdated).toHaveBeenCalledTimes(1);
    expect(chart.state).toEqual('ready');
  });
  test('surfaces chart mount errors instead of silently marking the view successful', () => {
    const chart = { onMount: vi.fn(() => { throw new Error('renderer init failed'); }) };
    broker.register(chart as unknown as IChart);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      expect(() => broker.publish(ChartLifecycle.Mounted, mockOptions, mockContext))
        .toThrow('renderer init failed');
    } finally {
      spy.mockRestore();
    }
  });

});
