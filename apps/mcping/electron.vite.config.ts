import { defineConfig } from 'electron-vite';

// `build.externalizeDeps` defaults to true, so node_modules deps are kept
// external automatically (replaces the deprecated externalizeDepsPlugin).
export default defineConfig({
  main: {
    build: {
      outDir: 'dist/main',
    },
  },
});
