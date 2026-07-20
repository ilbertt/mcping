import { parseArgs } from 'node:util';

export enum AuthMode {
  ApiKey = 'apikey',
  OAuth = 'oauth',
}

function toAuthMode(value: string): AuthMode | undefined {
  return Object.values(AuthMode).find((mode) => mode === value);
}

export function parseCliOptions(): { authMode: AuthMode | undefined } {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: { auth: { type: 'string' } },
    allowPositionals: false,
  });
  const { auth } = values;
  if (auth === undefined) {
    return { authMode: undefined };
  }
  const authMode = toAuthMode(auth);
  if (!authMode) {
    throw new Error(
      `Invalid --auth value "${auth}". Expected one of: ${Object.values(AuthMode).join(', ')}`,
    );
  }
  return { authMode };
}
