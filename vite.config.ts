import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

const rendererRoot = fileURLToPath(new URL('./src/renderer', import.meta.url))

export default defineConfig({
  root: 'src/renderer',
  // data/ 目录整个当静态资源根：/augments.json、/builds/kaisa.json、/icons/... 都能直接访问
  publicDir: fileURLToPath(new URL('./data', import.meta.url)),
  plugins: [react(), tailwindcss()],
  server: { port: 5273, strictPort: false },
  build: {
    outDir: fileURLToPath(new URL('./dist-renderer', import.meta.url)),
    emptyOutDir: true,
    // 双入口：index.html = 主窗口(companion)，overlay.html = M2 透明置顶窗口
    rollupOptions: {
      input: {
        main: `${rendererRoot}/index.html`,
        overlay: `${rendererRoot}/overlay.html`,
      },
    },
  },
})
