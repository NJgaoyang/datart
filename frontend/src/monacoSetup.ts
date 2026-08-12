/**
 * Monaco Editor worker 配置（Vite）
 *
 * 原 CRA 使用 MonacoWebpackPlugin({ languages: [''] }) 仅注入核心 editor worker。
 * Vite 下通过 ?worker 导入并设置 self.MonacoEnvironment.getWorker 提供等价能力。
 * 需在创建任何编辑器之前引入本模块（见 entryPointFactory）。
 */
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';

self.MonacoEnvironment = {
  getWorker() {
    return new editorWorker();
  },
};
