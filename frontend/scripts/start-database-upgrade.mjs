import { createServer } from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { readFile, mkdir, open, readdir } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { loadUpgradeEngine } from './legacy-upgrade/runtime.mjs';

const directory = join(
  dirname(fileURLToPath(import.meta.url)),
  'legacy-upgrade',
);
const digest = value =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
const targetOf = connection => ({
  host: connection.host.toLowerCase(),
  port: connection.port,
  database: connection.database,
});

export function validateConnection(value) {
  if (!value || typeof value !== 'object')
    throw new Error('请填写数据库连接信息');
  const { host, database, username, password } = value;
  const port = Number(value.port);
  if (
    typeof host !== 'string' ||
    !/^[A-Za-z0-9._-]+$/.test(host) ||
    typeof database !== 'string' ||
    !/^[A-Za-z0-9_-]+$/.test(database) ||
    host.length > 253 ||
    database.length > 64 ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  )
    throw new Error('数据库地址、名称或端口无效');
  if (
    typeof username !== 'string' ||
    !username ||
    typeof password !== 'string' ||
    username.length > 128 ||
    password.length > 4096
  )
    throw new Error('数据库账号或密码无效');
  if (typeof value.tls !== 'boolean')
    throw new Error('请选择是否启用 TLS 加密');
  return { host, port, database, username, password, tls: value.tls };
}

export function databaseBridge(serverDirectory) {
  return request =>
    new Promise((resolve, reject) => {
      const child = spawn(
        'java',
        [
          '--class-path',
          join(serverDirectory, 'lib/*'),
          join(directory, 'DatabaseUpgrade.java'),
        ],
        { stdio: ['pipe', 'pipe', 'pipe'] },
      );
      const stdout = [],
        stderr = [];
      let length = 0;
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error('数据库操作超时，请重新检查状态；已生成的备份会保留'));
      }, 150000);
      child.stdout.on('data', data => {
        length += data.length;
        if (length > 128 * 1024 * 1024) {
          child.kill();
          reject(new Error('所选组织配置超过工具处理上限，无法生成升级计划'));
        } else stdout.push(data);
      });
      child.stderr.on('data', data => {
        if (Buffer.concat(stderr).length < 16000) stderr.push(data);
      });
      child.on('error', error => {
        clearTimeout(timer);
        reject(
          new Error('无法启动数据库连接程序，请检查 JDK：' + error.message),
        );
      });
      child.on('close', code => {
        clearTimeout(timer);
        try {
          const result = JSON.parse(Buffer.concat(stdout).toString());
          if (code !== 0 || result.error)
            reject(new Error(result.error || '数据库操作失败，请重新检查状态'));
          else resolve(result);
        } catch {
          reject(
            new Error(
              '数据库连接程序未能运行，请检查后端安装目录和 JDK：' +
                Buffer.concat(stderr).toString().slice(0, 1500),
            ),
          );
        }
      });
      child.stdin.on('error', () => {});
      child.stdin.end(JSON.stringify(request));
    });
}

async function jsonBody(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 65536) throw new Error('请求内容过大');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString());
}

const resourceKeys = snapshot =>
  new Set([
    ...(snapshot.dashboards || []).map(row => 'dashboard:' + row.id),
    ...(snapshot.widgets || []).map(row => 'widget:' + row.id),
    ...(snapshot.datacharts || []).map(row => 'datachart:' + row.id),
  ]);
const canReadBackup = (record, keys) =>
  record.kind === 'manual'
    ? [...resourceKeys(record.baseline)].every(key => keys.has(key))
    : record.changes.every(change => keys.has(change.table + ':' + change.id));

export async function createUpgradeServer({ engine, bridge, backupDir }) {
  await mkdir(backupDir, { recursive: true, mode: 0o700 });
  const sessions = new Map();
  let busy = false;
  const html = await readFile(join(directory, 'database-upgrade.html'), 'utf8');
  const assets = new Map([
    ['/', ['text/html; charset=utf-8', html]],
    [
      '/app.js',
      [
        'text/javascript; charset=utf-8',
        await readFile(join(directory, 'database-upgrade.js')),
      ],
    ],
    [
      '/style.css',
      [
        'text/css; charset=utf-8',
        await readFile(join(directory, 'database-upgrade.css')),
      ],
    ],
  ]);
  const readBackup = async (id, connection) => {
    if (typeof id !== 'string' || !/^[a-zA-Z0-9-]+\.json$/.test(id))
      throw new Error('备份标识无效');
    const { hash, record } = JSON.parse(
      await readFile(join(backupDir, id), 'utf8'),
    );
    if (!record || record.schemaVersion !== 1 || hash !== digest(record))
      throw new Error('备份校验失败，不能执行回滚');
    if (digest(record.target) !== digest(targetOf(connection)))
      throw new Error('备份对应的数据库与当前连接不一致');
    return record;
  };
  const saveBackup = async record => {
    const id = Date.now() + '-' + randomBytes(8).toString('hex') + '.json';
    const file = await open(join(backupDir, id), 'wx', 0o600);
    try {
      await file.writeFile(
        JSON.stringify({ hash: digest(record), record }, null, 2),
      );
      await file.sync();
    } finally {
      await file.close();
    }
    const folder = await open(backupDir, 'r');
    try {
      await folder.sync();
    } finally {
      await folder.close();
    }
    return id;
  };
  return createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    );
    const send = (status, value) => {
      response.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
      });
      response.end(JSON.stringify(value));
    };
    let acquired = false,
      backupId,
      state,
      connection,
      organizations,
      plan;
    try {
      const host = new URL('http://' + request.headers.host);
      if (!['localhost', '127.0.0.1'].includes(host.hostname))
        return send(403, { error: '仅允许本机访问' });
      const path = new URL(request.url, host).pathname;
      if (request.method === 'GET' && assets.has(path)) {
        const [type, body] = assets.get(path);
        if (path === '/') {
          for (const [key, session] of sessions)
            if (Date.now() - session.lastSeen > 3600000) sessions.delete(key);
          if (sessions.size >= 64)
            return send(503, { error: '工具窗口过多，请重启工具后再打开' });
          const token = randomBytes(32).toString('hex');
          sessions.set(token, { organizations: [], lastSeen: Date.now() });
          response.writeHead(200, { 'Content-Type': type });
          response.end(body.replace('__TOOL_TOKEN__', token));
          return;
        }
        response.writeHead(200, { 'Content-Type': type });
        response.end(body);
        return;
      }
      if (!path.startsWith('/api/') || request.method !== 'POST')
        return send(404, { error: '入口不存在' });
      if (
        request.headers.origin !== host.origin ||
        request.headers['content-type']?.split(';')[0] !== 'application/json'
      )
        return send(403, { error: '请求校验失败，请从工具首页重新打开' });
      state = sessions.get(request.headers['x-tool-token']);
      if (!state || Date.now() - state.lastSeen > 3600000)
        return send(403, { error: '会话已失效，请刷新页面重新连接' });
      state.lastSeen = Date.now();
      ({ connection, organizations, plan } = state);
      if (busy) return send(409, { error: '当前操作尚未结束，请稍后重试' });
      busy = acquired = true;
      const input = await jsonBody(request);
      if (path === '/api/connect') {
        connection = undefined;
        organizations = [];
        plan = undefined;
        const settings = validateConnection(input);
        const result = await bridge({
          action: 'organizations',
          connection: settings,
        });
        connection = settings;
        organizations = result.organizations;
        return send(200, { organizations });
      }
      if (!connection) throw new Error('请先连接数据库');
      if (!organizations.some(org => org.id === input.orgId))
        throw new Error('请选择当前数据库中的组织');
      if (path === '/api/preview') {
        plan = undefined;
        const baseline = await bridge({
          action: 'snapshot',
          connection,
          orgId: input.orgId,
        });
        const preview = engine.buildDatabasePlan(baseline);
        plan = {
          id: randomBytes(24).toString('hex'),
          target: targetOf(connection),
          baseline,
          ...preview,
        };
        return send(200, { ...preview, planId: plan.id });
      }
      if (path === '/api/backup') {
        const baseline = await bridge({
          action: 'snapshot',
          connection,
          orgId: input.orgId,
        });
        backupId = await saveBackup({
          schemaVersion: 1,
          kind: 'manual',
          createdAt: new Date().toISOString(),
          target: targetOf(connection),
          orgId: input.orgId,
          baseline,
          changes: [],
        });
        return send(200, {
          backupId,
          backupPath: join(backupDir, backupId),
          resources: resourceKeys(baseline).size,
        });
      }
      if (path === '/api/backups') {
        const readable = resourceKeys(
          await bridge({ action: 'snapshot', connection, orgId: input.orgId }),
        );
        const backups = [];
        for (const id of await readdir(backupDir)) {
          if (!id.endsWith('.json')) continue;
          try {
            const record = await readBackup(id, connection);
            if (record.orgId === input.orgId && canReadBackup(record, readable))
              backups.push({
                id,
                createdAt: record.createdAt,
                changes: record.changes.length,
                kind: record.kind || 'upgrade',
                resources: resourceKeys(record.baseline).size,
              });
          } catch {
            /* Backups for other databases or damaged files cannot be used here. */
          }
        }
        return send(200, {
          backups: backups.sort((a, b) =>
            b.createdAt.localeCompare(a.createdAt),
          ),
        });
      }
      if (path === '/api/apply') {
        if (
          !plan ||
          plan.id !== input.planId ||
          plan.orgId !== input.orgId ||
          plan.issues.length ||
          !plan.changes.length
        )
          throw new Error('没有可执行的升级预览，请重新检查');
        const pending = plan;
        plan = undefined;
        const record = {
          schemaVersion: 1,
          createdAt: new Date().toISOString(),
          target: pending.target,
          orgId: pending.orgId,
          baseline: pending.baseline,
          changes: pending.changes,
        };
        backupId = await saveBackup(record);
        const result = await bridge({
          action: 'apply',
          connection,
          orgId: record.orgId,
          baseline: record.baseline,
          changes: record.changes,
        });
        return send(200, {
          ...result,
          backupId,
          backupPath: join(backupDir, backupId),
        });
      }
      if (path === '/api/rollback-preview') {
        const readable = resourceKeys(
          await bridge({ action: 'snapshot', connection, orgId: input.orgId }),
        );
        const record = await readBackup(input.backupId, connection);
        if (record.kind === 'manual')
          throw new Error('手动备份用于保存原始配置，在线回滚请选择升级备份');
        if (!canReadBackup(record, readable))
          throw new Error('当前数据库账号无法读取这些报表配置');
        if (record.orgId !== input.orgId) throw new Error('备份不属于当前组织');
        return send(200, {
          changes: record.changes.map(change => ({
            ...change,
            before: change.after,
            after: change.before,
          })),
        });
      }
      if (path === '/api/rollback') {
        const record = await readBackup(input.backupId, connection);
        if (record.kind === 'manual')
          throw new Error('手动备份用于保存原始配置，在线回滚请选择升级备份');
        if (record.orgId !== input.orgId) throw new Error('备份不属于当前组织');
        plan = undefined;
        const result = await bridge({
          action: 'rollback',
          connection,
          orgId: record.orgId,
          baseline: record.baseline,
          changes: record.changes,
        });
        return send(200, result);
      }
      return send(404, { error: '入口不存在' });
    } catch (error) {
      const message = String(error.message || '操作失败');
      send(400, {
        error: connection?.password
          ? message.split(connection.password).join('***')
          : message,
        ...(backupId
          ? { backupId, backupPath: join(backupDir, backupId) }
          : {}),
      });
    } finally {
      if (acquired) {
        Object.assign(state, { connection, organizations, plan });
        busy = false;
      }
    }
  });
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const args = process.argv.slice(2);
  const option = name => {
    const index = args.indexOf(name);
    return index < 0 ? undefined : args[index + 1];
  };
  const serverDirectory = option('--server-dir');
  if (args.includes('--help') || !serverDirectory) {
    console.log(
      '用法：node scripts/start-database-upgrade.mjs --server-dir /opt/datart [--port 8099] [--backup-dir /安全的备份目录]',
    );
    process.exit(args.includes('--help') ? 0 : 1);
  }
  const port = Number(option('--port') || 8099);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('端口无效');
  const engine = await loadUpgradeEngine();
  const backupDir = resolve(
    option('--backup-dir') || join(homedir(), '.datart-upgrade/backups'),
  );
  const server = await createUpgradeServer({
    engine,
    bridge: databaseBridge(resolve(serverDirectory)),
    backupDir,
  });
  server.on('error', async error => {
    console.error('启动失败：' + error.message);
    await engine.close();
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () =>
    console.log(
      `数据库升级工具已启动：http://127.0.0.1:${port}\n备份目录：${backupDir}\n连接信息仅保存在内存中，关闭后清除。`,
    ),
  );
  const close = () =>
    server.close(async () => {
      await engine.close();
      process.exit();
    });
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
}
