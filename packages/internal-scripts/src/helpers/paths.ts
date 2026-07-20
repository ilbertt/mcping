import { join } from 'node:path';

/** Absolute path to the monorepo root, resolved from this file's `src/helpers/` dir. */
export const REPO_ROOT = join(import.meta.dir, '..', '..', '..', '..');
