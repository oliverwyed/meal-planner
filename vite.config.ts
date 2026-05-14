import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

function swCacheVersion(): Plugin {
  return {
    name: 'sw-cache-version',
    closeBundle() {
      const swPath = resolve(__dirname, 'dist/sw.js');
      const content = readFileSync(swPath, 'utf8');
      writeFileSync(swPath, content.replace('__BUILD_TS__', Date.now().toString()));
    },
  };
}

export default defineConfig({
  plugins: [react(), swCacheVersion()],
})
