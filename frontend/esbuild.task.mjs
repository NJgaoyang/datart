import esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 用 esbuild 直接打包 task.ts（替代原 rollup 管线）。
// 背景：
//  1) 原 rollup + @rollup/plugin-typescript 在 TS 5.4 下对 task.ts 的庞大依赖树做全量
//     类型检查会陷入死循环（恒定高内存 + 100% CPU 卡死）；
//  2) 即便换成 esbuild 转译插件并去掉 babel，rollup 2（纯 JS、单线程）+ commonjs 打包
//     该依赖树（含 core-js/lodash/echarts 工具等数百模块）仍需 8+ 分钟，不可接受。
// esbuild（Go 实现、并行）打包同一依赖树仅需数秒，且原生支持 TS/JSX/CJS-ESM 互操作，
// 并自动读取 tsconfig.json 的 baseUrl(./src) 解析 app/... 路径别名。
// 注：parser.js 由后端 Nashorn 执行，而 Java 17 已移除 Nashorn（需另配 nashorn-core/GraalVM
// 引擎，属独立问题），故此处不再做 ES5 降级。
await esbuild.build({
  entryPoints: [path.resolve(__dirname, 'src/task.ts')],
  bundle: true,
  format: 'iife',
  // 后端通过 invokeFunction("getQueryData", type, json) 调用全局函数
  globalName: 'getQueryData',
  target: 'es2018',
  platform: 'browser',
  outfile: path.resolve(__dirname, 'public/task/parser.js'),
  define: { 'process.env.PUBLIC_URL': '""' },
  // task.ts 为 export default；iife 会把命名空间 { default: fn } 赋给全局名，
  // 此处解包默认导出，使全局 getQueryData 直接为可调用函数。
  footer: { js: 'getQueryData=getQueryData.default||getQueryData;' },
  tsconfig: path.resolve(__dirname, 'tsconfig.json'),
  logLevel: 'warning',
});
console.log('task bundle 构建完成 -> public/task/parser.js');
