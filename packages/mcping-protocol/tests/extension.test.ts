import { describe, expect, test } from 'bun:test';
import { isValidThirdPartyExtensionId, MCPING_EXTENSION_ID } from '#extension.ts';

describe('mcping extension identifier', () => {
  test('is a valid, non-reserved third-party identifier', () => {
    expect(isValidThirdPartyExtensionId(MCPING_EXTENSION_ID)).toBe(true);
  });

  test('rejects reserved prefixes (second label modelcontextprotocol / mcp)', () => {
    expect(isValidThirdPartyExtensionId('io.modelcontextprotocol/tasks')).toBe(false);
    expect(isValidThirdPartyExtensionId('dev.mcp/thing')).toBe(false);
    expect(isValidThirdPartyExtensionId('com.mcp.tools/thing')).toBe(false);
  });

  test('accepts non-reserved prefixes whose second label is not mcp/modelcontextprotocol', () => {
    expect(isValidThirdPartyExtensionId('com.example.mcp/thing')).toBe(true);
    expect(isValidThirdPartyExtensionId('com.example/my-extension')).toBe(true);
  });

  test('rejects malformed identifiers (missing prefix or name)', () => {
    expect(isValidThirdPartyExtensionId('mcping')).toBe(false);
    expect(isValidThirdPartyExtensionId('io.github.ilbertt/')).toBe(false);
    expect(isValidThirdPartyExtensionId('/mcping')).toBe(false);
    expect(isValidThirdPartyExtensionId('1io.github/mcping')).toBe(false);
  });
});
