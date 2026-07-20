export {};

declare module 'bun' {
  interface Env {
    /** Temp file the `prepare-release` workflow reads the computed version from. */
    VERSION_FILE: string;
    /** Temp file the publish workflow reads the extracted release notes from. */
    RELEASE_NOTES_FILE: string;
    /** GitHub Actions: base server URL, e.g. `https://github.com`. */
    GITHUB_SERVER_URL?: string;
    /** GitHub Actions: `owner/repo` slug of the running workflow. */
    GITHUB_REPOSITORY?: string;
  }
}
