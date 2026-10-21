import {
  parseBoardConfig,
  parseWidgets,
  serializeConfig,
} from '../configParser';

it('reads current reports without changing saved values, versions or layout', () => {
  const board = {
    type: 'auto',
    version: '1.0.0-RC.4',
    layoutVersion: 2,
    jsonConfig: { props: [] },
  };
  expect(parseBoardConfig(JSON.stringify(board))).toEqual(board);
  const config = {
    type: 'chart',
    version: '1.0.0-RC.4',
    customConfig: { props: [{ key: 'padding', value: 8 }] },
  };
  const widgets = [
    {
      id: 'w',
      config: JSON.stringify(config),
      relations: [{ id: 'r', config: '{"target":"chart"}' }],
    },
  ] as any;
  const before = structuredClone(widgets);
  expect(parseWidgets(widgets)[0]).toEqual({
    id: 'w',
    config,
    relations: [{ id: 'r', config: { target: 'chart' } }],
  });
  expect(widgets).toEqual(before);
});

it('rejects old or broken reports instead of silently replacing them with an empty dashboard', () => {
  expect(() => parseBoardConfig('{"type":"auto","margin":[1,1]}')).toThrow(
    '独立升级工具',
  );
  expect(() => parseBoardConfig('{')).toThrow();
  expect(() => parseWidgets([{ config: '{', relations: [] }] as any)).toThrow();
});

it('serializes current object configs and preserves wire strings', () => {
  expect(serializeConfig({ expensiveQuery: true })).toBe(
    '{"expensiveQuery":true}',
  );
  expect(serializeConfig('{"version":"custom"}')).toBe('{"version":"custom"}');
  expect(serializeConfig(undefined)).toBe('');
});
