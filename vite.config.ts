import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Windows 上 chokidar 的原生监听偶发漏事件（文件被编辑器/杀软短暂占用时），
  // 表现为"改了代码但界面没变"。轮询虽然多花一点 CPU，但改动必定生效。
  server: {
    // tauri.conf.json 的 devUrl 写死了 5173。如果不锁端口，vite 会静默换到
    // 5174，而 Tauri 仍然去连 5173 —— 表现为白屏或加载到上一个遗留的 dev 服务。
    // 锁死端口后，端口被占会直接报错，比"看起来正常但连错了"好得多。
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
})
