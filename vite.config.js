import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

// inbox.html (Hil's private message reader) is added as a second page when present
const input = { main: resolve(import.meta.dirname, 'index.html') };
if (existsSync(resolve(import.meta.dirname, 'inbox.html'))) input.inbox = resolve(import.meta.dirname, 'inbox.html');

export default defineConfig({
  // BASE_PATH is set by the GitHub Pages workflow for project pages, e.g. /portfolio/
  base: process.env.BASE_PATH || '/',
  build: { rollupOptions: { input } },
});
