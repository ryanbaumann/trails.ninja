import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  // Set base to './' to ensure relative asset paths in the build output
  base: './',
  build: {
    // Output directory is 'dist' by default, which is fine
    // outDir: 'dist',
  },
});