import { defineConfig } from 'electron-vite';
import packageJson from './package.json' with { type: 'json' };

// Bundle local workspace packages into the main/preload output instead of
// externalizing them: they ship raw TS with no published artifact to require()
// at runtime, so they must compile in as if they were app source folders.
// Derived from the typed manifest, so it stays in sync with the actual deps and
// covers every `workspace:*` package automatically. Third-party deps stay external.
const localPackages = Object.entries(packageJson.dependencies)
  .filter(([, version]) => version.startsWith('workspace:'))
  .map(([name]) => name);

export default defineConfig({
  main: {
    build: {
      outDir: 'dist/main',
      externalizeDeps: { exclude: localPackages },
    },
  },
  preload: {
    build: {
      outDir: 'dist/preload',
      externalizeDeps: { exclude: localPackages },
    },
  },
  renderer: {
    build: {
      outDir: 'dist/renderer',
    },
  },
});
