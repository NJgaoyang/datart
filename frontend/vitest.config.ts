import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

// Vitest 配置：复用 baseUrl 路径别名与 styled-components babel 插件。
// globals: true 注入 describe/it/expect/vi 运行时全局（类型由 @types/jest 提供）。
export default defineConfig({
  plugins: [
    react({
      babel: { plugins: ['babel-plugin-styled-components'] },
    }),
    tsconfigPaths(),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test/jestShim.ts', 'jest-canvas-mock', 'src/setupTests.ts'],
    css: false,
    include: ['src/**/__tests__/**/*.{spec,test}.{js,jsx,ts,tsx}'],
    testTimeout: 20000,
  },
});
