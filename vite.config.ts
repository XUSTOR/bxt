import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Windows 上 chokidar 的原生监听偶发漏事件（文件被编辑器/杀软短暂占用时），
  // 表现为"改了代码但界面没变"。轮询虽然多花一点 CPU，但改动必定生效。
  server: {
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
})
