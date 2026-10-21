import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  readFile,
  writeFile,
  readdir,
  rm,
  stat,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createUpgradeServer,
  validateConnection,
} from '../start-database-upgrade.mjs';

const settings = {
  host: '127.0.0.1',
  port: 3306,
  database: 'datart',
  username: 'operator',
  password: 'never-save-this-password',
  tls: false,
};

test('connection validation rejects SQL fragments, invalid ports and missing credentials', () => {
  assert.equal(validateConnection(settings).database, 'datart');
  for (const value of [
    { ...settings, database: 'datart; DROP' },
    { ...settings, host: 'localhost/other' },
    { ...settings, port: 0 },
    { ...settings, username: '' },
  ])
    assert.throws(() => validateConnection(value));
});

test('web tool requires same-origin access, previews without writing, backs up before applying and validates rollback files', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'datart-db-web-test-'));
  const calls = [];
  let canRead = true;
  const before = '{"version":"old"}',
    after = '{"version":"new"}';
  const engine = {
    buildDatabasePlan: baseline => ({
      orgId: baseline.orgId,
      counts: { dashboards: 1, widgets: 0, datacharts: 0 },
      issues: [],
      changes: [
        { table: 'dashboard', id: 'board', name: '报表', before, after },
      ],
    }),
  };
  const bridge = async request => {
    calls.push(request.action);
    if (request.action === 'organizations')
      return {
        organizations: [
          { id: 'org-a', name: '甲' },
          { id: 'org-b', name: '乙' },
        ],
      };
    if (request.action === 'snapshot')
      return {
        orgId: request.orgId,
        dashboards: canRead ? [{ id: 'board', config: before }] : [],
        widgets: [],
        datacharts: [],
      };
    if (request.action === 'apply') {
      const files = await readdir(folder);
      assert.equal(files.length, 1);
      const content = await readFile(join(folder, files[0]), 'utf8');
      assert.equal(content.includes(settings.password), false);
      assert.equal((await stat(join(folder, files[0]))).mode & 0o777, 0o600);
      assert.equal(JSON.parse(content).record.changes[0].before, before);
    }
    return { success: true, changed: 1 };
  };
  const server = await createUpgradeServer({
    engine,
    bridge,
    backupDir: folder,
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const page = await (await fetch(base)).text();
  const token = page.match(/name="tool-token" content="([^"]+)"/)[1];
  const post = async (path, body, headers = {}) => {
    const response = await fetch(base + '/api/' + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: base,
        'X-Tool-Token': token,
        ...headers,
      },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  try {
    assert.equal(
      (await post('connect', settings, { Origin: 'https://untrusted.example' }))
        .status,
      403,
    );
    assert.equal(
      (await post('connect', settings, { 'X-Tool-Token': 'wrong' })).status,
      403,
    );
    assert.equal(calls.length, 0);
    assert.equal((await post('connect', settings)).status, 200);
    const otherToken = (await (await fetch(base)).text()).match(
      /name="tool-token" content="([^"]+)"/,
    )[1];
    assert.notEqual(otherToken, token);
    assert.equal(
      (
        await post(
          'preview',
          { orgId: 'org-a' },
          { 'X-Tool-Token': otherToken },
        )
      ).status,
      400,
    );
    const preview = (await post('preview', { orgId: 'org-a' })).body;
    assert.deepEqual(calls, ['organizations', 'snapshot']);
    assert.equal((await readdir(folder)).length, 0);
    assert.equal(
      (await post('apply', { orgId: 'org-b', planId: preview.planId })).status,
      400,
    );
    const applied = await post('apply', {
      orgId: 'org-a',
      planId: preview.planId,
    });
    assert.equal(applied.status, 200);
    assert.equal(
      (await post('apply', { orgId: 'org-a', planId: preview.planId })).status,
      400,
    );
    assert.equal(calls.filter(action => action === 'apply').length, 1);
    const backupId = applied.body.backupId;
    assert.equal(
      (await post('rollback', { orgId: 'org-b', backupId })).status,
      400,
    );
    assert.equal(
      (await post('rollback', { orgId: 'org-a', backupId: '../file.json' }))
        .status,
      400,
    );
    canRead = false;
    assert.equal(
      (await post('rollback-preview', { orgId: 'org-a', backupId })).status,
      400,
    );
    canRead = true;
    const reverse = await post('rollback-preview', {
      orgId: 'org-a',
      backupId,
    });
    assert.equal(reverse.body.changes[0].after, before);
    const file = join(folder, backupId),
      original = await readFile(file, 'utf8');
    // Replace the signed content directly to make the integrity check meaningful.
    const damaged = JSON.parse(original);
    damaged.record.changes[0].before = '{}';
    await writeFile(file, JSON.stringify(damaged));
    assert.equal(
      (await post('rollback', { orgId: 'org-a', backupId })).status,
      400,
    );
    assert.equal(calls.includes('rollback'), false);
    await writeFile(file, original);
    assert.equal(
      (await post('rollback', { orgId: 'org-a', backupId })).status,
      200,
    );
    assert.equal(calls.filter(action => action === 'rollback').length, 1);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(folder, { recursive: true, force: true });
  }
});

test('an incomplete scan blocks all writes and a failed backup never reaches the database writer', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'datart-db-web-block-'));
  const folder = join(parent, 'backups');
  const calls = [];
  let blocked = true;
  const engine = {
    buildDatabasePlan: () => ({
      orgId: 'org',
      counts: { dashboards: 1, widgets: 0, datacharts: 0 },
      changes: [
        {
          table: 'dashboard',
          id: 'board',
          before: '{}',
          after: '{"version":"new"}',
        },
      ],
      issues: blocked ? [{ message: 'broken configuration' }] : [],
    }),
  };
  const bridge = async ({ action }) => {
    calls.push(action);
    return action === 'organizations'
      ? { organizations: [{ id: 'org', name: '组织' }] }
      : { orgId: 'org' };
  };
  const server = await createUpgradeServer({
    engine,
    bridge,
    backupDir: folder,
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const token = (await (await fetch(base)).text()).match(
    /name="tool-token" content="([^"]+)"/,
  )[1];
  const post = async (path, body = {}) => {
    const response = await fetch(base + '/api/' + path, {
      method: 'POST',
      headers: {
        Origin: base,
        'Content-Type': 'application/json',
        'X-Tool-Token': token,
      },
      body: JSON.stringify({ orgId: 'org', ...body }),
    });
    return { status: response.status, body: await response.json() };
  };
  try {
    await post('connect', settings);
    let preview = (await post('preview')).body;
    assert.equal((await post('apply', { planId: preview.planId })).status, 400);
    assert.equal((await readdir(folder)).length, 0);
    blocked = false;
    preview = (await post('preview')).body;
    await rm(folder, { recursive: true });
    await writeFile(folder, 'not-a-directory');
    assert.equal((await post('apply', { planId: preview.planId })).status, 400);
    assert.equal(calls.includes('apply'), false);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(parent, { recursive: true, force: true });
  }
});

test('manual backup needs no upgrade preview, saves every configuration and never writes to the database', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'datart-db-manual-'));
  const calls = [];
  let canRead = true;
  const baseline = {
    orgId: 'org',
    dashboards: [{ id: 'board', name: '报表', config: '{"version":"current"}' }],
    widgets: [{ id: 'widget', dashboardId: 'board', config: '{}' }],
    datacharts: [{ id: 'chart', name: '图表', config: '{}' }],
  };
  const server = await createUpgradeServer({
    engine: { buildDatabasePlan: () => assert.fail('backup must not run converters') },
    bridge: async ({ action }) => {
      calls.push(action);
      if (action === 'organizations')
        return { organizations: [{ id: 'org', name: '组织' }] };
      assert.equal(action, 'snapshot', 'read-only database accounts must be sufficient');
      return canRead ? baseline : { ...baseline, widgets: [] };
    },
    backupDir: folder,
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const page = await (await fetch(base)).text();
  assert.match(page, /id="create-backup" disabled>立即备份/);
  const token = page.match(/name="tool-token" content="([^"]+)"/)[1];
  const post = async (path, body = {}) => {
    const response = await fetch(base + '/api/' + path, {
      method: 'POST',
      headers: { Origin: base, 'Content-Type': 'application/json', 'X-Tool-Token': token },
      body: JSON.stringify({ orgId: 'org', ...body }),
    });
    return { status: response.status, body: await response.json() };
  };
  try {
    assert.equal((await post('backup')).status, 400);
    await post('connect', settings);
    assert.equal((await post('backup', { orgId: 'other' })).status, 400);
    const result = await post('backup');
    assert.equal(result.status, 200);
    assert.equal(result.body.resources, 3);
    assert.deepEqual(calls, ['organizations', 'snapshot']);
    const content = await readFile(result.body.backupPath, 'utf8');
    const saved = JSON.parse(content);
    assert.equal(saved.record.kind, 'manual');
    assert.deepEqual(saved.record.baseline, baseline);
    assert.deepEqual(saved.record.changes, []);
    assert.equal(content.includes(settings.password), false);
    assert.equal((await stat(result.body.backupPath)).mode & 0o777, 0o600);
    const listed = (await post('backups')).body.backups;
    assert.equal(listed.length, 1);
    assert.equal(listed[0].kind, 'manual');
    assert.equal(listed[0].resources, 3);
    for (const path of ['rollback-preview', 'rollback']) {
      const rejected = await post(path, { backupId: result.body.backupId });
      assert.equal(rejected.status, 400);
      assert.match(rejected.body.error, /在线回滚请选择升级备份/);
    }
    canRead = false;
    assert.deepEqual((await post('backups')).body.backups, []);
    await rm(folder, { recursive: true });
    await writeFile(folder, 'not-a-directory');
    assert.equal((await post('backup')).status, 400);
    assert.equal(calls.some(action => !['organizations', 'snapshot'].includes(action)), false);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(folder, { recursive: true, force: true });
  }
});
