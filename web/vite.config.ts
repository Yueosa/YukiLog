import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '/' : '/admin/',
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:3000',
      '/media': {
        target: 'http://127.0.0.1:3000',
        // 开发预览种子媒体（web/public/media/seed/*）不走代理，直接由 vite 静态服务
        bypass: (req) => (req.url?.startsWith('/media/seed/') ? req.url : undefined),
      },
      '/subscriptions': 'http://127.0.0.1:3000',
      '/feed.xml': 'http://127.0.0.1:3000',
      '/feeds': 'http://127.0.0.1:3000',
    },
  },
  build: {
    manifest: true,
    outDir: 'dist',
    emptyOutDir: true,
  },
}));
