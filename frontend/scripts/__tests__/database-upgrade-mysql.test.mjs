import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { databaseBridge } from '../start-database-upgrade.mjs';
import { loadUpgradeEngine } from '../legacy-upgrade/runtime.mjs';

const configPath = process.env.DATART_TEST_MYSQL_CONFIG;
const serverDir = process.env.DATART_TEST_SERVER_DIR;

test(
  'real MySQL apply, exact rollback, concurrent edits, transactional failure and organization isolation',
  { skip: !configPath || !serverDir, timeout: 180000 },
  async () => {
    const original = JSON.parse(await readFile(configPath, 'utf8'));
    const connection = {
      ...original,
      database: 'datart_upgrade_test_' + randomBytes(8).toString('hex'),
    };
    const fixtureFile = fileURLToPath(
      new URL('./fixtures/DatabaseUpgradeFixture.java', import.meta.url),
    );
    const fixture = (action, extra = {}) =>
      new Promise((resolve, reject) => {
        const child = spawn(
          'java',
          ['--class-path', join(serverDir, 'lib/*'), fixtureFile],
          { stdio: ['pipe', 'pipe', 'pipe'] },
        );
        const out = [],
          errors = [];
        child.stdout.on('data', data => out.push(data));
        child.stderr.on('data', data => errors.push(data));
        child.on('error', reject);
        child.on('close', code =>
          code
            ? reject(new Error(Buffer.concat(errors).toString()))
            : resolve(Buffer.concat(out).toString()),
        );
        child.stdin.end(JSON.stringify({ action, connection, ...extra }));
      });
    const bridge = databaseBridge(resolve(serverDir));
    const engine = await loadUpgradeEngine();
    const read = () =>
      bridge({ action: 'snapshot', connection, orgId: 'org-a' });
    let created = false;
    try {
      await fixture('setup');
      created = true;
      const baseline = await read();
      const untouched = await fixture('sentinel');
      const plan = engine.buildDatabasePlan(baseline);
      assert.deepEqual(plan.issues, []);
      assert.equal(plan.changes.length, 3);
      const write = action =>
        bridge({
          action,
          connection,
          orgId: 'org-a',
          baseline,
          changes: plan.changes,
        });
      await fixture('edit-board', { config: '{"edited-after-preview":true}' });
      await assert.rejects(write('apply'), /预览后发生了变化/);
      assert.equal(
        (await read()).widgets[0].config,
        baseline.widgets[0].config,
      );
      await fixture('edit-board', { config: baseline.dashboards[0].config });
      await fixture('fail-updates');
      await assert.rejects(write('apply'), /simulated-update-failure/);
      assert.deepEqual(await read(), baseline);
      await fixture('allow-updates');
      assert.equal((await write('apply')).changed, 3);
      const upgraded = await read();
      assert.equal(
        JSON.parse(upgraded.dashboards[0].config).version,
        '1.0.0-RC.4',
      );
      assert.equal(await fixture('sentinel'), untouched);
      await fixture('edit-widget', { config: '{"edited-after-upgrade":true}' });
      await assert.rejects(write('rollback'), /目标配置已变化/);
      assert.equal(
        (await read()).dashboards[0].config,
        upgraded.dashboards[0].config,
      );
      await fixture('edit-widget', { config: upgraded.widgets[0].config });
      assert.equal((await write('rollback')).changed, 3);
      assert.deepEqual(await read(), baseline);
      assert.equal(await fixture('sentinel'), untouched);
      await fixture('nontransactional');
      await assert.rejects(write('apply'), /InnoDB/);
      assert.deepEqual(await read(), baseline);
    } finally {
      if (created) await fixture('drop');
      await engine.close();
    }
  },
);
