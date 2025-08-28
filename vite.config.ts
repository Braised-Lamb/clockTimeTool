import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // 开发环境使用默认根路径，构建时使用相对路径便于 Electron 加载本地文件
  base: command === 'build' ? './' : '/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: undefined, // 单文件输出，减少加载时间
      },
    },
  },
  server: {
    host: true, // 允许局域网访问
  },
}))
