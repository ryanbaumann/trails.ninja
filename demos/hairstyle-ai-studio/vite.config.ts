import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The repository gateway owns the same-origin Gemini proxy. Run it from the
// repository root, then Vite forwards local /api calls to port 8080.
export default defineConfig(() => {
  return {
    base: './',
    server: {
      port: 3000,
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
