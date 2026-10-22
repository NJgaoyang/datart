const $ = id => document.getElementById(id);
const token = document.querySelector('meta[name="tool-token"]').content;
let planId,
  connected = false,
  running = false,
  backups = [],
  previewReady = false;
const orgId = () => $('organization').value;
function status(message, error = false) {
  $('status').textContent = message;
  $('status').classList.toggle('error', error);
}
function controls() {
  $('connect').disabled = running;
  $('organization').disabled = running || !connected;
  $('preview').disabled = running || !connected || !orgId();
  $('refresh-backups').disabled = running || !connected || !orgId();
  $('create-backup').disabled = running || !connected || !orgId();
  $('backup').disabled = running || !backups.length;
  const selectedBackup = backups.find(item => item.id === $('backup').value);
  $('rollback').disabled = running || !selectedBackup || selectedBackup.kind === 'manual';
  $('apply').disabled = running || !previewReady || !$('confirm').checked;
  $('execute-rollback').disabled =
    running || !$('rollback-confirm').checked || !$('backup').value;
}
async function request(path, body) {
  const response = await fetch('/api/' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tool-Token': token },
    body: JSON.stringify({ orgId: orgId(), ...body }),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      result.error +
        (result.backupPath ? '\n备份已保留：' + result.backupPath : ''),
    );
  return result;
}
async function perform(message, action) {
  running = true;
  controls();
  status(message);
  try {
    await action();
  } catch (error) {
    status(error.message, true);
  } finally {
    running = false;
    controls();
  }
}
function clearPreview() {
  planId = undefined;
  previewReady = false;
  $('confirm').checked = false;
  $('summary').textContent = '请选择组织并重新检查报表配置。';
  $('apply-area').hidden = true;
  $('changes').replaceChildren();
  $('issues').replaceChildren();
  $('counts').replaceChildren();
  $('rollback-review').hidden = true;
  $('rollback-confirm').checked = false;
}
async function refreshBackups() {
  backups = (await request('backups')).backups;
  $('backup').replaceChildren();
  for (const backup of backups)
    $('backup').add(
      new Option(
        `${new Date(backup.createdAt).toLocaleString()} · ${
          backup.kind === 'manual'
            ? `手动备份 · ${backup.resources} 条配置`
            : `升级备份 · ${backup.changes} 条修改`
        }`,
        backup.id,
      ),
    );
  if (!backups.length) $('backup').add(new Option('暂无备份', ''));
  $('rollback-review').hidden = true;
  $('rollback-confirm').checked = false;
  controls();
}
function renderChanges(
  container,
  changes,
  beforeLabel = '升级前',
  afterLabel = '升级后',
) {
  container.replaceChildren();
  const types = { dashboard: '仪表板', widget: '组件', datachart: '图表' };
  for (const change of changes) {
    const details = document.createElement('details'),
      summary = document.createElement('summary');
    summary.textContent = `${types[change.table]} · ${change.name}`;
    details.append(summary);
    const diff = document.createElement('div');
    diff.className = 'diff';
    for (const [key, label] of [
      ['before', beforeLabel],
      ['after', afterLabel],
    ]) {
      const column = document.createElement('div'),
        title = document.createElement('strong'),
        pre = document.createElement('pre');
      title.textContent = label;
      pre.textContent = JSON.stringify(JSON.parse(change[key]), null, 2);
      column.append(title, pre);
      diff.append(column);
    }
    details.append(diff);
    container.append(details);
  }
}
$('connection-form').addEventListener('submit', event => {
  event.preventDefault();
  clearPreview();
  connected = false;
  backups = [];
  $('backup-result').textContent = '';
  const form = new FormData(event.target);
  const settings = Object.fromEntries(form);
  settings.port = Number(settings.port);
  settings.tls = form.has('tls');
  perform('正在连接数据库…', async () => {
    const result = await request('connect', settings);
    connected = true;
    $('organization').replaceChildren();
    for (const org of result.organizations)
      $('organization').add(new Option(org.name || org.id, org.id));
    if (!result.organizations.length)
      $('organization').add(new Option('数据库中没有组织', ''));
    event.target.elements.password.value = '';
    if (orgId()) await refreshBackups();
    $('summary').textContent = '请选择需要处理的组织，然后检查报表配置。';
    status('连接成功。检查不会修改数据库。');
  });
});
$('organization').addEventListener('change', () => {
  clearPreview();
  $('backup-result').textContent = '';
  perform('正在读取备份列表…', async () => {
    await refreshBackups();
    status('组织已切换，请重新检查报表配置。');
  });
});
$('preview').addEventListener('click', () =>
  perform('正在检查报表配置，请稍候…', async () => {
    clearPreview();
    const result = await request('preview');
    planId = result.planId;
    for (const [key, label] of [
      ['dashboards', '仪表板'],
      ['datacharts', '图表'],
      ['widgets', '组件'],
    ]) {
      const item = document.createElement('span');
      item.className = 'count';
      item.textContent = `${label} ${result.counts[key]}`;
      $('counts').append(item);
    }
    for (const issue of result.issues) {
      const item = document.createElement('p');
      item.className = 'issue';
      item.textContent = `${issue.name}：${issue.message}`;
      $('issues').append(item);
    }
    renderChanges($('changes'), result.changes);
    previewReady = result.issues.length === 0 && result.changes.length > 0;
    $('apply-area').hidden = !previewReady;
    const message = result.issues.length
      ? `发现 ${result.issues.length} 项需要人工核查的问题，本次不能执行升级。`
      : result.changes.length
      ? `预计升级 ${result.changes.length} 条配置。展开条目核对后，再执行备份和升级。`
      : '所选组织的报表配置已符合当前格式，无需升级。';
    $('summary').textContent = message;
    status(message, result.issues.length > 0);
  }),
);
$('confirm').addEventListener('change', controls);
$('apply').addEventListener('click', () =>
  perform('正在保存备份并执行升级，请勿关闭工具…', async () => {
    const selectedPlan = planId;
    planId = undefined;
    previewReady = false;
    const result = await request('apply', { planId: selectedPlan });
    clearPreview();
    await refreshBackups();
    status(
      `升级完成，已更新 ${result.changed} 条配置。请刷新 Datart 报表。\n备份：${result.backupPath}`,
    );
  }),
);
$('create-backup').addEventListener('click', () =>
  perform('正在备份所选组织的报表配置…', async () => {
    const result = await request('backup');
    const message = `备份完成，已保存 ${result.resources} 条配置。服务器文件：${result.backupPath}`;
    $('backup-result').textContent = message;
    status(message);
    await refreshBackups();
  }),
);
$('refresh-backups').addEventListener('click', () =>
  perform('正在读取备份列表…', async () => {
    await refreshBackups();
    status('备份列表已刷新。');
  }),
);
$('backup').addEventListener('change', () => {
  $('rollback-review').hidden = true;
  $('rollback-confirm').checked = false;
  controls();
});
$('rollback').addEventListener('click', () =>
  perform('正在读取回滚预览…', async () => {
    const backup = backups.find(item => item.id === $('backup').value);
    const result = await request('rollback-preview', { backupId: backup.id });
    $('rollback-summary').textContent = `将恢复 ${new Date(
      backup.createdAt,
    ).toLocaleString()} 备份中的 ${
      backup.changes
    } 条原始配置。执行时会检查这些配置是否在升级后又被修改。`;
    renderChanges(
      $('rollback-changes'),
      result.changes,
      '升级后的配置',
      '恢复后的配置',
    );
    $('rollback-review').hidden = false;
    $('rollback-confirm').checked = false;
  }),
);
$('rollback-confirm').addEventListener('change', controls);
$('execute-rollback').addEventListener('click', () =>
  perform('正在恢复原始配置，请勿关闭工具…', async () => {
    $('rollback-confirm').checked = false;
    const result = await request('rollback', { backupId: $('backup').value });
    clearPreview();
    status(`回滚完成，已恢复 ${result.changed} 条配置。请刷新 Datart 报表。`);
  }),
);
controls();
