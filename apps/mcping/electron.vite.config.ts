import { defineConfig } from 'electron-vite';

export default defineConfig({
  main: {
    build: {
      outDir: 'dist/main',
      externalizeDeps: true,
    },
  },
  preload: {
    build: {
      outDir: 'dist/preload',
      externalizeDeps: true,
    },
  },
  renderer: {
    build: {
      outDir: 'dist/renderer',
    },
  },
});
