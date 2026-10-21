import { mkdtemp, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

export async function loadUpgradeEngine() {
  const directory = dirname(fileURLToPath(import.meta.url));
  const root = join(directory, '../..');
  const temporary = await mkdtemp(join(root, 'node_modules/.legacy-upgrade-'));
  let dom;
  try {
    const bundled = join(temporary, 'engine.cjs');
    await build({
      entryPoints: [join(directory, 'entry.ts')],
      outfile: bundled,
      bundle: true,
      platform: 'node',
      format: 'cjs',
      tsconfig: join(directory, 'tsconfig.json'),
      plugins: [
        {
          name: 'dependencies',
          setup(build) {
            build.onResolve({ filter: /^[^./]/ }, args =>
              /^(app|utils|styles|locales|store|types|hooks)\//.test(
                args.path,
              ) || ['globalConstants', 'i18n', 'locales'].includes(args.path)
                ? null
                : { path: args.path, external: true },
            );
          },
        },
      ],
      loader: { '.css': 'empty', '.less': 'empty' },
    });
    // Historical defaults read browser storage; keep that environment inside the offline tool.
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
    return {
      ...createRequire(bundled)(bundled),
      async close() {
        dom.window.close();
        await rm(temporary, { recursive: true, force: true });
      },
    };
  } catch (error) {
    dom?.window.close();
    await rm(temporary, { recursive: true, force: true });
    throw error;
  }
}
