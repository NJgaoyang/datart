import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { gzipSync, gunzipSync } from 'node:zlib';
const execute = promisify(execFile);
const tool = fileURLToPath(
  new URL('../upgrade-legacy-template.mjs', import.meta.url),
);

test('upgrades an actual gzip template file and refuses overwrite or damaged input', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'datart-template-test-'));
  try {
    const input = join(directory, 'old.viz'),
      output = join(directory, 'new.viz');
    const source = {
      type: 'datart.server.base.transfer.model.DatachartTemplateModel',
      formatVersion: 1,
      payload: {
        datachart: {
          id: 'keep-id',
          config: '{"computedFields":[],"chartConfig":{"datas":[]}}',
        },
      },
    };
    const bytes = gzipSync(JSON.stringify(source));
    await writeFile(input, bytes);
    await execute(process.execPath, [
      tool,
      '--input',
      input,
      '--output',
      output,
    ]);
    const convertedBytes = await readFile(output);
    const converted = JSON.parse(gunzipSync(convertedBytes));
    assert.equal(converted.formatVersion, 2);
    assert.equal(converted.payload.datachart.id, 'keep-id');
    assert.deepEqual(await readFile(input), bytes);
    await assert.rejects(
      execute(process.execPath, [tool, '--input', input, '--output', output]),
    );
    assert.deepEqual(await readFile(output), convertedBytes);
    const broken = join(directory, 'broken.viz'),
      absent = join(directory, 'absent.viz');
    await writeFile(broken, '{');
    await assert.rejects(
      execute(process.execPath, [tool, '--input', broken, '--output', absent]),
    );
    await assert.rejects(access(absent));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
