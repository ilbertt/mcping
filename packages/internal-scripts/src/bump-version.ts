#!/usr/bin/env bun
import { join } from 'node:path';
import { writeOutput } from '#helpers/output.ts';
import { REPO_ROOT } from '#helpers/paths.ts';
import { getNextVersion } from '#helpers/version.ts';

const version = await getNextVersion();

const PACKAGE_JSON_PATH = join(REPO_ROOT, 'apps/mcping/package.json');
const pkg = await Bun.file(PACKAGE_JSON_PATH).json();
pkg.version = version;
await Bun.write(PACKAGE_JSON_PATH, `${JSON.stringify(pkg, null, 2)}\n`);

await writeOutput({ outFile: Bun.env.VERSION_FILE, content: version });
