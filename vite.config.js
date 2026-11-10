import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        live: resolve(__dirname, 'live.html'),
        admin: resolve(__dirname, 'admin.html'),
        slides: resolve(__dirname, 'slides/index.html'),
      },
    },
    chunkSizeWarningLimit: 1500,
  },
});
