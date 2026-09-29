import { defineConfig } from 'vite';

// Relative base so the build works from any sub-path (static hosting, previews).
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 900 },
});
