import test from 'node:test';
import assert from 'node:assert';
import {
  blacklistToken,
  isTokenBlacklisted,
  _cleanup,
  _clearBlacklist,
  _getBlacklistSize,
  BLACKLIST_TTL,
  BLACKLIST_CLEANUP_INTERVAL
} from './token-blacklist.js';

test('Token Blacklist Module', async (t) => {
  // Reset state before each test
  t.beforeEach(() => {
    _clearBlacklist();
  });

  await t.test('isTokenBlacklisted should return false for unknown tokens', () => {
    assert.strictEqual(isTokenBlacklisted('unknown-token'), false);
  });

  await t.test('blacklistToken should add a token to the blacklist', () => {
    const token = 'test-token';
    blacklistToken(token);
    assert.strictEqual(isTokenBlacklisted(token), true);
    assert.strictEqual(_getBlacklistSize(), 1);
  });

  await t.test('isTokenBlacklisted should handle multiple tokens', () => {
    blacklistToken('token-1');
    blacklistToken('token-2');
    assert.strictEqual(isTokenBlacklisted('token-1'), true);
    assert.strictEqual(isTokenBlacklisted('token-2'), true);
    assert.strictEqual(isTokenBlacklisted('token-3'), false);
    assert.strictEqual(_getBlacklistSize(), 2);
  });

  await t.test('isTokenBlacklisted should expire and remove old tokens', (context) => {
    const mockToken = 'expired-token';
    const now = Date.now();

    // Use mock timers to simulate passage of time
    context.mock.timers.enable({ apis: ['Date'] });

    blacklistToken(mockToken);
    assert.strictEqual(isTokenBlacklisted(mockToken), true);

    // Advance time past TTL
    context.mock.timers.tick(BLACKLIST_TTL + 1000);

    assert.strictEqual(isTokenBlacklisted(mockToken), false, 'Token should be reported as not blacklisted after TTL');
    assert.strictEqual(_getBlacklistSize(), 0, 'Token should be removed from Map after checked and found expired');
  });

  await t.test('periodic cleanup should remove expired tokens', async (context) => {
    context.mock.timers.enable({ apis: ['Date'] });

    _clearBlacklist();
    blacklistToken('token-to-expire');

    assert.strictEqual(_getBlacklistSize(), 1);

    // Advance time past TTL
    context.mock.timers.tick(BLACKLIST_TTL + 1);

    // Should still be 1 because isTokenBlacklisted wasn't called yet
    assert.strictEqual(_getBlacklistSize(), 1, 'Should still have 1 token before cleanup');

    // Trigger cleanup manually since mocking setInterval across ESM module boundaries
    // can be unreliable if the interval was started before the mock.
    _cleanup();

    assert.strictEqual(_getBlacklistSize(), 0, 'Periodic cleanup should have removed expired tokens');
  });

  await t.test('blacklistToken should use custom expiresAt if provided', (context) => {
    context.mock.timers.enable({ apis: ['Date'] });
    const token = 'custom-ttl-token';
    const customTTL = 5000;
    const expiresAt = Date.now() + customTTL;

    blacklistToken(token, expiresAt);
    assert.strictEqual(isTokenBlacklisted(token), true);

    // Advance time past the custom TTL but before the default TTL
    context.mock.timers.tick(customTTL + 1000);

    assert.strictEqual(isTokenBlacklisted(token), false, 'Token should be removed after custom TTL');
  });
});
