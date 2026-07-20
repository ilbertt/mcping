export {};

declare module 'bun' {
  interface Env {
    /** Temp file the `prepare-release` workflow reads the computed version from. */
    VERSION_FILE: string;
    /** Temp file the publish workflow reads the extracted release notes from. */
    RELEASE_NOTES_FILE: string;
    /** `actions/attest` step output: URL of the build-provenance attestation. */
    ATTESTATION_URL?: string;
  }
}
