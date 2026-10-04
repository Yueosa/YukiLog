import { defineConfig } from 'vite';

export default defineConfig({
  base: '/admin/',
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:3000',
      '/media': 'http://127.0.0.1:3000',
      '/subscriptions': 'http://127.0.0.1:3000',
    },
  },
  build: {
    manifest: true,
    outDir: 'dist',
    emptyOutDir: true,
  },
});
