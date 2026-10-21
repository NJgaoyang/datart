import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { gunzipSync, gzipSync } from 'node:zlib';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const option = name => {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
};
const input = option('--input');
const output = option('--output');
if (!input || !output || args.includes('--help')) {
  console.log(
    '用法：node scripts/upgrade-legacy-template.mjs --input old.viz --output upgraded.viz [--server-dir /opt/datart]',
  );
  process.exit(args.includes('--help') ? 0 : 1);
}
const temporary = await mkdtemp(join(root, 'node_modules/.legacy-template-'));
let dom;
try {
  const bytes = await readFile(resolve(input));
  const compressed = bytes[0] === 0x1f && bytes[1] === 0x8b;
  const decoded = compressed
    ? gunzipSync(bytes, { maxOutputLength: 128 * 1024 * 1024 })
    : bytes;
  let source;
  if (decoded[0] === 0xac && decoded[1] === 0xed) {
    const serverDir = option('--server-dir');
    if (!serverDir)
      throw new Error(
        '早期 Java 二进制模板还需 --server-dir 指定当前后端安装目录',
      );
    const converted = join(temporary, 'envelope.json');
    const classpath = join(resolve(serverDir), 'lib/*');
    const read = spawnSync(
      'java',
      [
        '--class-path',
        classpath,
        join(root, 'scripts/legacy-upgrade/LegacyTemplateEnvelope.java'),
        resolve(input),
        converted,
      ],
      { encoding: 'utf8' },
    );
    if (read.status !== 0) throw new Error('读取早期模板失败：' + read.stderr);
    source = JSON.parse(await readFile(converted, 'utf8'));
  } else {
    source = JSON.parse(decoded.toString('utf8'));
  }
  const bundled = join(temporary, 'convert.cjs');
  await build({
    entryPoints: [join(root, 'scripts/legacy-upgrade/convert.ts')],
    outfile: bundled,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    tsconfig: join(root, 'scripts/legacy-upgrade/tsconfig.json'),
    plugins: [
      {
        name: 'dependencies',
        setup(build) {
          build.onResolve({ filter: /^[^./]/ }, args =>
            /^(app|utils|styles|locales|store|types|hooks)\//.test(args.path) ||
            ['globalConstants', 'i18n', 'locales'].includes(args.path)
              ? null
              : { path: args.path, external: true },
          );
        },
      },
    ],
    loader: { '.css': 'empty', '.less': 'empty' },
  });
  const { JSDOM } = await import('jsdom');
  dom = new JSDOM('', { url: 'http://localhost/' });
  for (const key of [
    'window',
    'document',
    'localStorage',
    'sessionStorage',
    'navigator',
    'HTMLElement',
  ]) {
    Object.defineProperty(globalThis, key, {
      value: dom.window[key],
      configurable: true,
    });
  }
  const { upgradeTemplate } = createRequire(bundled)(bundled);
  const converted = upgradeTemplate(source);
  const json = Buffer.from(JSON.stringify(converted, null, 2));
  await writeFile(resolve(output), compressed ? gzipSync(json) : json, {
    flag: 'wx',
    mode: 0o600,
  });
  console.log('模板已升级，原文件保留：' + resolve(output));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  dom?.window.close();
  await rm(temporary, { recursive: true, force: true });
}
