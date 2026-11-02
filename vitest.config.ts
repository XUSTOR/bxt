import { defineConfig } from "vitest/config";

/**
 * 单元测试只跑纯函数（不碰 DOM、不碰 xterm、不碰 Tauri IPC），
 * 所以用 node 环境即可，不需要 jsdom。
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
