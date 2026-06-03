import dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET_ENV = process.env.JWT_SECRET;
if (!JWT_SECRET_ENV && process.env.NODE_ENV === 'production') {
  throw new Error('FATAL: JWT_SECRET environment variable is missing in production!');
}

export const JWT_SECRET = JWT_SECRET_ENV || 'dev-secret-change-in-production';
export const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';
export const SALT_ROUNDS = 10;

export const COOKIE_MAX_AGE_FLAGS = process.env.NODE_ENV === 'production'
  ? 'HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400'
  : 'HttpOnly; SameSite=Strict; Path=/; Max-Age=86400';

export const COOKIE_CLEAR_FLAGS = process.env.NODE_ENV === 'production'
  ? 'HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'
  : 'HttpOnly; SameSite=Strict; Path=/; Max-Age=0';

export const TIER_LIMITS = {
  free: {
    maxLocations: 3,
    maxApiCallsPerDay: 100,
    features: ['current', 'hourly', '3day'],
    premiumFeatures: ['7day', 'alerts', 'unlimitedLocations'],
  },
  premium: {
    maxLocations: Infinity,
    maxApiCallsPerDay: Infinity,
    features: ['current', 'hourly', '3day', '7day', 'alerts', 'unlimitedLocations'],
    premiumFeatures: [],
  }
};
