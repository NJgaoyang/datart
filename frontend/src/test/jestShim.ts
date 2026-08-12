import { vi } from 'vitest';

/**
 * jest-canvas-mock 内部依赖 jest 全局对象（jest.fn 等），
 * 在 Vitest 中不存在 jest 全局，这里用 vi 提供等价兼容。
 * 必须在 jest-canvas-mock 之前加载（见 vitest.config.ts setupFiles 顺序）。
 */
(globalThis as any).jest = (globalThis as any).jest || vi;
