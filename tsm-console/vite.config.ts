import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const isGitHubPagesBuild = process.env.GITHUB_ACTIONS === 'true';

export default defineConfig({
  base: isGitHubPagesBuild ? '/Tri-State-Systems-Manager/' : '/',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Dev: forward token exchange to local backend proxy
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
