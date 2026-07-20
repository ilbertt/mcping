#!/usr/bin/env bun
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
  content: `${notes}${attestationFooter()}`,
});

/**
 * Note appended after the changelog pointing users to the build-provenance
 * attestation for this release's assets. `ATTESTATION_URL` is the `actions/attest`
 * step output; it is absent for local previews, where the footer is omitted.
 */
function attestationFooter() {
  const attestationUrl = Bun.env.ATTESTATION_URL;
  if (!attestationUrl) {
    return '';
  }

  return `

---

🔒 **These assets are safe.** This release is immutable and every asset was built and signed on GitHub Actions. Verify the build provenance [here](${attestationUrl}).
`;
}
