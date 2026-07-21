/**
 * The mcping extension's reverse-DNS identifier. `io.github.ilbertt` is the
 * reverse of the GitHub Pages domain `ilbertt.github.io`; `mcping` is the
 * extension name. Per the 2026-07-28 `_meta` key naming rules (spec
 * `basic/index#meta`, SEP-2133), a prefix is reserved for MCP only when its
 * SECOND label is `modelcontextprotocol` or `mcp`. Here the second label is
 * `github`, so this is a valid, non-reserved third-party identifier.
 */
export const MCPING_EXTENSION_ID = 'io.github.ilbertt/mcping';

/**
 * The entry the demo server WOULD advertise in `ServerCapabilities.extensions`
 * (surfaced via `server/discover`), mirroring how Tasks advertises
 * `io.modelcontextprotocol/tasks`. An empty settings object means "supported,
 * no settings".
 *
 * mcp-use@beta hardcodes its server capabilities and exposes no passthrough for
 * this map, so the entry cannot be advertised on the wire yet — see the demo
 * README ("Design notes"). Kept here as the single source of the intended
 * declaration for tests and future wiring.
 */
export const MCPING_EXTENSION_CAPABILITY: Readonly<Record<string, Record<string, never>>> = {
  [MCPING_EXTENSION_ID]: {},
};

const RESERVED_SECOND_LABELS = new Set(['modelcontextprotocol', 'mcp']);
const EXTENSION_ID_PATTERN = /^([^/]+)\/(.+)$/;
const PREFIX_LABEL_PATTERN = /^[a-zA-Z]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
const EXTENSION_NAME_PATTERN = /^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?$/;

/**
 * Whether `id` is a valid, non-reserved third-party MCP extension identifier: a
 * reverse-DNS prefix, `/`, then a name — with the prefix's SECOND label neither
 * `modelcontextprotocol` nor `mcp`. Encodes the `_meta` key naming rules from
 * the 2026-07-28 spec (`basic/index#meta`).
 */
export function isValidThirdPartyExtensionId(id: string): boolean {
  const match = EXTENSION_ID_PATTERN.exec(id);
  if (!match) {
    return false;
  }
  const [, prefix, name] = match;
  if (prefix === undefined || name === undefined) {
    return false;
  }
  if (!EXTENSION_NAME_PATTERN.test(name)) {
    return false;
  }
  const labels = prefix.split('.');
  if (!labels.every((label) => PREFIX_LABEL_PATTERN.test(label))) {
    return false;
  }
  const secondLabel = labels.at(1);
  return secondLabel === undefined || !RESERVED_SECOND_LABELS.has(secondLabel);
}
