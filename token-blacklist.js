// Token Blacklist Module for Weather Dashboard PWA
// Manages invalidated JWT tokens with automatic TTL-based cleanup

const tokenBlacklist = new Map();

// Tokens expire automatically after 24 hours to prevent unbounded growth
export const BLACKLIST_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
export const BLACKLIST_TTL = 24 * 60 * 60 * 1000; // 24 hours

export function _cleanup() {
  const now = Date.now();
  for (const [token, expiry] of tokenBlacklist.entries()) {
    if (expiry < now) {
      tokenBlacklist.delete(token);
    }
  }
}

// Cleanup expired tokens from blacklist periodically
const cleanupInterval = setInterval(_cleanup, BLACKLIST_CLEANUP_INTERVAL);

// .unref() allows the process to exit if only the timer is active (useful for tests)
if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

/**
 * Add token to blacklist
 * @param {string} token
 * @param {number} [expiresAt] - Optional absolute expiration time in ms
 */
export function blacklistToken(token, expiresAt = null) {
  const expiry = expiresAt ? expiresAt : Date.now() + BLACKLIST_TTL;
  tokenBlacklist.set(token, expiry);
}

/**
 * Check if token is blacklisted
 * @param {string} token
 * @returns {boolean}
 */
export function isTokenBlacklisted(token) {
  const expiry = tokenBlacklist.get(token);
  if (!expiry) return false;
  if (expiry < Date.now()) {
    tokenBlacklist.delete(token);
    return false;
  }
  return true;
}

// For testing purposes
export function _getBlacklistSize() {
  return tokenBlacklist.size;
}

export function _clearBlacklist() {
  tokenBlacklist.clear();
}
