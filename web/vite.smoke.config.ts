// 本地冒烟配置：把 API 代理到生产，用真实数据验证新构建的 SPA（不进 git 长期配置，验证完可删）。
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '/' : '/admin/',
  server: {
    proxy: {
      '/api': { target: 'https://blog.yeastar.xin', changeOrigin: true, secure: true },
      '/media': {
        target: 'https://blog.yeastar.xin',
        changeOrigin: true,
        secure: true,
        bypass: (req) => (req.url?.startsWith('/media/seed/') ? req.url : undefined),
      },
      '/subscriptions': { target: 'https://blog.yeastar.xin', changeOrigin: true, secure: true },
      '/feed.xml': { target: 'https://blog.yeastar.xin', changeOrigin: true, secure: true },
      '/feeds': { target: 'https://blog.yeastar.xin', changeOrigin: true, secure: true },
    },
  },
  build: {
    manifest: true,
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: 'index.html',
        'yuki-app': 'src/ui/yuki-app.ts',
      },
    },
  },
}));
