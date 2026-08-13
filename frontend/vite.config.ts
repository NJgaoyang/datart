import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vite';
import svgr from 'vite-plugin-svgr';
import tsconfigPaths from 'vite-tsconfig-paths';

// 兼容 CRA 的 PUBLIC_URL（默认空，资源从站点根提供）
const publicUrl = process.env.PUBLIC_URL || '';

// 由 craco splitChunks cacheGroups 转换而来的 manualChunks（仅拆分 node_modules 大型库，
// 避免拆分应用代码导致 barrel 导出循环依赖）
const manualChunks = (id: string): string | undefined => {
  if (!id.includes('node_modules/')) {
    if (id.includes('/src/')) {
      // 入口模块（含 React 挂载副作用）保持独立 chunk，避免多入口副作用相互污染。
      if (id.endsWith('/src/index.tsx') || id.includes('.entry.ts')) return undefined;
      // 其余应用源码归入单一 'app' chunk：避免 barrel 循环依赖（如 components/index.tsx ↔
      // ListTitle/ListNav、FormGenerator/index.ts ↔ ItemLayout）被多入口代码分割拆到不同共享
      // chunk，导致跨 chunk 初始化顺序错乱报 TDZ（Cannot access 'X' before initialization）而白屏。
      return 'app';
    }
    return undefined;
  }
  // 所有 node_modules 归入单一 vendor chunk：datart 依赖的众多库存在相互读取内部属性
  // （如 X.version）、循环依赖或多份副本（如 quill/parchment 的 EmbedBlot）的情况。
  // 细粒度拆分这些库会导致跨 chunk 初始化顺序错乱，运行时陆续报
  // "Cannot read properties of undefined (reading '...')" / "Cannot access 'X' before initialization"
  // 等致命错误而白屏。合并为单一 vendor chunk（等价于 webpack 的 vendor bundle）可彻底规避。
  return 'vendor';
};

export default defineConfig({
  base: publicUrl || '/',
  resolve: {
    alias: {
      // Node 内置 events 模块的浏览器 polyfill。Vite 默认将 Node 内置模块外部化为
      // __viteBrowserExternal 占位，该占位卷入循环依赖会触发 TDZ（Cannot access
      // '__viteBrowserExternal' before initialization）而白屏。events.ts 用 EventEmitter 做事件总线。
      events: path.resolve(__dirname, 'node_modules/events/events.js'),
    },
  },
  plugins: [
    react({
      // 保留 styled-components 的 css prop 与 displayName
      babel: { plugins: ['babel-plugin-styled-components'] },
    }),
    svgr(),
    tsconfigPaths(),
    {
      // 自定义图表插件接口 + share 页面 SPA 回退（对应原 craco devServer 配置）
      name: 'datart-dev-middlewares',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && req.url.startsWith('/api/v1/plugins/custom/charts')) {
            const pluginPath = 'custom-chart-plugins';
            let data: string[] = [];
            try {
              const dir = fs.readdirSync(
                path.resolve(__dirname, `public/${pluginPath}`),
              );
              data = dir
                .filter(file => path.extname(file) === '.js')
                .map(file => `${pluginPath}/${file}`);
            } catch (e) {
              data = [];
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ data, errCode: 0, success: true }));
            return;
          }
          // share 路由回退到对应 HTML（historyApiFallback 等价）
          if (req.url) {
            if (/^\/shareChart\/\w/.test(req.url)) req.url = '/shareChart.html';
            else if (/^\/shareDashboard\/\w/.test(req.url))
              req.url = '/shareDashboard.html';
            else if (/^\/shareStoryPlayer\/\w/.test(req.url))
              req.url = '/shareStoryPlayer.html';
          }
          next();
        });
      },
    },
  ],
  define: {
    'process.env.PUBLIC_URL': JSON.stringify(publicUrl),
  },
  build: {
    outDir: 'build',
    chunkSizeWarningLimit: 4096,
    // 关闭产物 gzip 体积报告（纯 CPU 开销，对产物无影响，可缩短构建时间）
    reportCompressedSize: false,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        shareChart: path.resolve(__dirname, 'shareChart.html'),
        shareDashboard: path.resolve(__dirname, 'shareDashboard.html'),
        shareStoryPlayer: path.resolve(__dirname, 'shareStoryPlayer.html'),
      },
      output: {
        manualChunks,
        // 入口也必须带版本号。否则缓存中的旧 main.js 会继续引用已被
        // 新版发布删除的 vendor/app 分包，导致页面报“静态资源不存在”。
        entryFileNames: 'static/js/[name].[hash].js',
        chunkFileNames: 'static/js/[name].[hash].js',
        assetFileNames: 'static/[ext]/[name].[hash].[ext]',
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api/v1': { changeOrigin: true, target: 'http://localhost:8080/' },
      '/resources': { changeOrigin: true, target: 'http://localhost:8080/' },
    },
  },
});
