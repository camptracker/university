import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';

// Get git info at build time
const getGitInfo = () => {
  try {
    const hash = execSync('git rev-parse --short HEAD').toString().trim();
    const message = execSync('git log -1 --pretty=%s').toString().trim();
    const unixTimestamp = execSync('git log -1 --pretty=%ct').toString().trim();
    return { hash, message, timestamp: parseInt(unixTimestamp) * 1000 }; // Convert to milliseconds
  } catch {
    return { hash: 'dev', message: 'Development', timestamp: Date.now() };
  }
};

const gitInfo = getGitInfo();

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(gitInfo.hash),
    __APP_COMMIT_MSG__: JSON.stringify(gitInfo.message),
    __APP_COMMIT_TIME__: JSON.stringify(gitInfo.timestamp),
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/auth': 'http://localhost:3001',
    },
  },
});
