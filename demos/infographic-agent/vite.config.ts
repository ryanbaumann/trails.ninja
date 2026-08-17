import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
  return {
    base: './',
    server: {
      port: 3004,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: process.env.PROXY_TARGET || 'http://localhost:8080',
          changeOrigin: true,
        },
      },
    },
    plugins: [react()],
  };
});
