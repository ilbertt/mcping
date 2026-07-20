#!/usr/bin/env bun
import { runGitCliff } from 'git-cliff';
import { REPO_ROOT } from '#helpers/paths.ts';

const CHANGELOG_FILE = 'CHANGELOG.md';

const version = Bun.argv[2];
if (!version) {
  throw new Error('usage: bun src/generate-changelog.ts <version>');
}

// The CalVer version is computed elsewhere and passed in via `--tag`; git-cliff's
// own semver `--bump` is never used. The file is regenerated in full from git
// history + tags on every release (deterministic), so there is no first-run or
// prepend special-casing — the committed CHANGELOG.md is simply overwritten.
await runGitCliff({ tag: version, output: CHANGELOG_FILE }, { cwd: REPO_ROOT });
