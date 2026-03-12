import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';

// Get git commit hash at build time
const getGitHash = () => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'dev';
  }
};

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(getGitHash()),
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/auth': 'http://localhost:3001',
    },
  },
});
