import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { isTokenBlacklisted } from '../token-blacklist.js';
import { JWT_SECRET, TIER_LIMITS } from './config.js';

export function getCookieToken(req) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.split('=').map(c => c.trim());
    if (key) acc[key] = value;
    return acc;
  }, {});
  
  return cookies['weather_auth_token'] || null;
}

export function authenticateToken(req, res, next) {
  const token = getCookieToken(req);
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  if (isTokenBlacklisted(token)) {
    return res.status(403).json({ error: 'Token has been invalidated' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

export function checkTier(requiredTier = 'free') {
  return (req, res, next) => {
    const user = req.user;
    const userTier = user?.tier || 'free';
    
    if (requiredTier === 'premium' && userTier !== 'premium') {
      return res.status(403).json({ 
        error: 'Premium feature',
        upgradeRequired: true,
        message: 'This feature requires a premium subscription'
      });
    }
    
    next();
  };
}

export function tryAuthenticate(req, res, next) {
  const token = getCookieToken(req);
  
  if (!token || isTokenBlacklisted(token)) {
    return next();
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (!err) {
      req.user = user;
    }
    next();
  });
}

export const weatherRateLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: (req) => {
    const tier = req.user?.tier || 'free';
    const limit = TIER_LIMITS[tier]?.maxApiCallsPerDay || 100;
    return limit === Infinity ? 10000 : limit;
  },
  message: { error: 'Daily API limit reached. Upgrade to premium for unlimited access.' },
  keyGenerator: (req) => {
    return req.user ? req.user.email : req.ip;
  },
  validate: false,
  standardHeaders: true,
  legacyHeaders: false,
});

export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy (M-3)
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' https://upload.wikimedia.org https://placehold.co data:",
    "connect-src 'self' https://en.wikipedia.org"
  ].join('; '));
  
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

export function requireApiHeader(req, res, next) {
  if (req.headers['x-requested-with'] !== 'XMLHttpRequest') {
    return res.status(403).json({ error: 'CSRF validation failed: Missing or invalid X-Requested-With header' });
  }
  next();
}
