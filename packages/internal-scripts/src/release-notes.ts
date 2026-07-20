#!/usr/bin/env bun
import { $ } from 'bun';
import { runGitCliff } from 'git-cliff';
import { writeOutput } from '#helpers/output.ts';
import { REPO_ROOT } from '#helpers/paths.ts';

const { stdout } = await runGitCliff(
  { latest: true, strip: 'header' },
  { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'ignore'] },
);
const notes = String(stdout).trimEnd();

await writeOutput({
  outFile: Bun.env.RELEASE_NOTES_FILE,
  content: `${notes}${await attestationFooter()}`,
});

/**
 * Note appended after the changelog telling users the assets are immutable and
 * carry build-provenance attestations, linking to the repo's attestations page.
 * The repo slug is derived from the GitHub Actions env, falling back to the git
 * remote for local previews.
 */
async function attestationFooter() {
  const repo = await getRepoSlug();
  if (!repo) {
    return '';
  }

  const attestationsUrl = `https://github.com/${repo}/attestations`;

  return `

---

🔒 **These assets are safe.** This release is immutable and every asset was built and signed on GitHub Actions. Verify the build provenance [here](${attestationsUrl}).
`;
}

async function getRepoSlug() {
  if (Bun.env.GITHUB_REPOSITORY) {
    return Bun.env.GITHUB_REPOSITORY;
  }
  const remote = (
    await $`git config --get remote.origin.url`.cwd(REPO_ROOT).nothrow().text()
  ).trim();
  return remote.match(/github\.com[:/](.+?)(?:\.git)?$/)?.[1] ?? '';
}
