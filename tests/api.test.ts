import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api, ApiError, retryAfterMs } from '../expo-app/src/api';

test('Retry-After accepts seconds and HTTP dates and ignores invalid values', () => {
  const now = Date.parse('2026-11-10T12:00:00Z');
  assert.equal(retryAfterMs('120', now), 120000);
  assert.equal(retryAfterMs('Tue, 10 Nov 2026 12:15:00 GMT', now), 900000);
  assert.equal(retryAfterMs('Tue, 10 Nov 2026 11:00:00 GMT', now), 0);
  assert.equal(retryAfterMs(null, now), undefined);
  assert.equal(retryAfterMs('', now), undefined);
  assert.equal(retryAfterMs('invalid', now), undefined);
});

test('API errors expose the rate-limit cooldown even for a plain-text response', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('Too many requests', { status: 429, headers: { 'Retry-After': '900' } }));
  await assert.rejects(api('/sync', { records: [] }), error => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 429);
    assert.equal(error.retryAfterMs, 900000);
    return true;
  });
  assert.equal(fetch.mock.callCount(), 1);
});
