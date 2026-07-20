import { $ } from 'bun';
import { REPO_ROOT } from '#helpers/paths.ts';

/**
 * Computes the next release version using the CalVer scheme `YYYY.M.D-N`
 * (no leading zeros), e.g. `2026.7.20-1`.
 *
 * The trailing `-N` is a same-day counter, present on every release including
 * the first of the day. It cannot be omitted: semver ranks a version carrying a
 * pre-release tag *below* the same version without one (`2026.7.20-2 < 2026.7.20`),
 * so a plain first release would sort as newer than any same-day re-cut. Keeping
 * `-N` on every release makes same-day builds order correctly (`-1` < `-2` < …).
 */
export async function getNextVersion(): Promise<string> {
  const now = new Date();
  const base = `${now.getUTCFullYear()}.${now.getUTCMonth() + 1}.${now.getUTCDate()}`;

  const tags = (await $`git tag --list`.cwd(REPO_ROOT).text()).split('\n').filter(Boolean);
  const sameDayCount = tags.filter((tag) => tag.startsWith(`v${base}-`)).length;
  return `${base}-${sameDayCount + 1}`;
}
