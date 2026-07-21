import { describe, expect, test } from 'bun:test';
import { buildMcpingNotification } from '#notifications/build.ts';
import { MCPING_METHODS } from '#notifications/methods.ts';
import { parseMcpingNotification } from '#notifications/parse.ts';

describe('mcping push notification contract', () => {
  test('build → parse round-trips a valid push', () => {
    const built = buildMcpingNotification({
      method: MCPING_METHODS.push,
      params: { title: 'Deploy finished', body: 'prod #4821 in 3m12s' },
    });
    expect(built.method).toBe('notifications/mcping/push');

    const parsed = parseMcpingNotification(built);
    expect(parsed).not.toBeNull();
    expect(parsed?.method).toBe(MCPING_METHODS.push);
    expect(parsed?.params.title).toBe('Deploy finished');
  });

  test('build validates params (rejects an empty title)', () => {
    expect(() =>
      buildMcpingNotification({ method: MCPING_METHODS.push, params: { title: '' } }),
    ).toThrow();
  });

  test('build accepts the full presentational payload', () => {
    const parsed = parseMcpingNotification(
      buildMcpingNotification({
        method: MCPING_METHODS.push,
        params: { title: 'Alert', subtitle: 'prod', priority: 'critical', silent: true },
      }),
    );
    expect(parsed?.params.priority).toBe('critical');
    expect(parsed?.params.silent).toBe(true);
  });

  test('parse returns null for a non-mcping notification', () => {
    expect(parseMcpingNotification({ method: 'notifications/tools/list_changed' })).toBeNull();
  });

  test('parse accepts a delivered wire frame (jsonrpc + optional _meta)', () => {
    const frame = {
      jsonrpc: '2.0',
      method: MCPING_METHODS.push,
      params: {
        title: 'Deployed api',
        _meta: { 'io.modelcontextprotocol/subscriptionId': 1 },
      },
    };
    const parsed = parseMcpingNotification(frame);
    expect(parsed?.method).toBe(MCPING_METHODS.push);
    expect(parsed?.params.title).toBe('Deployed api');
  });
});
