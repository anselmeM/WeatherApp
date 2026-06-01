// Backend Authentication Module for Weather Dashboard PWA
// Implements Freemium Tier Model with JWT Authentication

import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import { blacklistToken, isTokenBlacklisted } from './token-blacklist.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// ============================================
// AUTHENTICATION CONFIGURATION
// ============================================
const JWT_SECRET_ENV = process.env.JWT_SECRET;
if (!JWT_SECRET_ENV && process.env.NODE_ENV === 'production') {
  throw new Error('FATAL: JWT_SECRET environment variable is missing in production!');
}
const JWT_SECRET = JWT_SECRET_ENV || 'dev-secret-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';
const SALT_ROUNDS = 10;

// Cookie flags configured for production (Secure) and local dev (no Secure flag over HTTP)
const COOKIE_MAX_AGE_FLAGS = process.env.NODE_ENV === 'production'
  ? 'HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400'
  : 'HttpOnly; SameSite=Strict; Path=/; Max-Age=86400';

const COOKIE_CLEAR_FLAGS = process.env.NODE_ENV === 'production'
  ? 'HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'
  : 'HttpOnly; SameSite=Strict; Path=/; Max-Age=0';

// User tiers configuration
const TIER_LIMITS = {
  free: {
    maxLocations: 3,
    maxApiCallsPerDay: 100,
    features: ['current', 'hourly', '7day'],
    premiumFeatures: ['historical', 'alerts', 'unlimitedLocations'],
  },
  premium: {
    maxLocations: Infinity,
    maxApiCallsPerDay: Infinity,
    features: ['current', 'hourly', '7day', 'historical', 'alerts', 'unlimitedLocations'],
    premiumFeatures: [],
  }
};

// Simple file-based persistence for users
const DB_FILE = './users.json';

function loadUsers() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      return new Map(Object.entries(data));
    }
  } catch (e) {
    console.error('Failed to load users database:', e);
  }
  return new Map();
}

const users = loadUsers();

function saveUsers() {
  try {
    const obj = Object.fromEntries(users);
    fs.writeFileSync(DB_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save users database:', e);
  }
}


// ============================================
// MIDDLEWARE
// ============================================
// HTTPS Redirection (Production only)
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(`https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// Basic Security Headers (Mime-sniffing, Clickjacking, and HSTS)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.use(express.json());

// Serve landing.html as the default page (instead of index.html)
// IMPORTANT: Place this BEFORE express.static to ensure it's hit first
app.get('/', (req, res) => {
  res.sendFile('landing.html', { root: 'public' });
});

// Serve dummy favicon to prevent 404 logs in browser console
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

app.use(express.static('public', { index: 'landing.html' }));

// Helper to parse JWT token from browser cookies
function getCookieToken(req) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.split('=').map(c => c.trim());
    if (key) acc[key] = value;
    return acc;
  }, {});
  
  return cookies['weather_auth_token'] || null;
}

// 🔐 JWT Authentication Middleware
function authenticateToken(req, res, next) {
  const token = getCookieToken(req);
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Check if token is blacklisted (invalidated by logout)
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

// 🔐 Tier Check Middleware
function checkTier(requiredTier = 'free') {
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

// 🔐 JWT Pre-Authentication Middleware (Does not block on failure, just extracts user info if present)
function tryAuthenticate(req, res, next) {
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

// 🔐 Dynamic Rate Limit Middleware with Tier Support
const weatherRateLimiter = rateLimit({
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

// ============================================
// AUTHENTICATION ROUTES
// ============================================

// POST /api/auth/register - User Registration
app.post('/api/auth/register', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 registrations per 15 minutes
  message: { error: 'Too many registration attempts. Please try again later.' }
}), async (req, res) => {
  try {
    const { email, password, tier = 'free' } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    
    // Check if user exists
    if (users.has(email.toLowerCase())) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    
    // Create user
    const user = {
      email: email.toLowerCase(),
      password: hashedPassword,
      tier: tier === 'premium' ? 'premium' : 'free',
      createdAt: new Date().toISOString(),
      locations: [],
      apiCalls: 0
    };
    
    users.set(email.toLowerCase(), user);
    saveUsers(); // Persist users database
    
    // Generate token
    const token = jwt.sign(
      { email: user.email, tier: user.tier },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );
    
    res.setHeader('Set-Cookie', `weather_auth_token=${token}; ${COOKIE_MAX_AGE_FLAGS}`);
    res.status(201).json({
      message: 'Registration successful',
      user: { email: user.email, tier: user.tier }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login - User Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Find user
    const user = users.get(email.toLowerCase());
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate token
    const token = jwt.sign(
      { email: user.email, tier: user.tier },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );
    
    res.setHeader('Set-Cookie', `weather_auth_token=${token}; ${COOKIE_MAX_AGE_FLAGS}`);
    res.json({
      message: 'Login successful',
      user: { email: user.email, tier: user.tier }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/logout - User Logout (invalidate token)
app.post('/api/auth/logout', authenticateToken, (req, res) => {
  const token = getCookieToken(req);
  
  if (token) {
    // Add token to blacklist to invalidate it
    // Pass JWT expiration (in ms) to ensure the token remains blacklisted for its entire lifetime
    const expiresAt = req.user && req.user.exp ? req.user.exp * 1000 : null;
    blacklistToken(token, expiresAt);
  }
  
  res.setHeader('Set-Cookie', `weather_auth_token=; ${COOKIE_CLEAR_FLAGS}`);
  res.json({ message: 'Logout successful' });
});

// POST /api/auth/upgrade - Upgrade to Premium
app.post('/api/auth/upgrade', authenticateToken, async (req, res) => {
  const { email } = req.user;
  const user = users.get(email);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // Update tier (in production, verify payment here)
  user.tier = 'premium';
  users.set(email, user);
  saveUsers(); // Persist users database
  
  // Generate new token with premium tier
  const token = jwt.sign(
    { email: user.email, tier: user.tier },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
  
  res.setHeader('Set-Cookie', `weather_auth_token=${token}; ${COOKIE_MAX_AGE_FLAGS}`);
  res.json({
    message: 'Upgrade successful!',
    user: { email: user.email, tier: user.tier }
  });
});

// GET /api/auth/profile - Get User Profile
app.get('/api/auth/profile', authenticateToken, (req, res) => {
  const { email } = req.user;
  const user = users.get(email);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  res.json({
    email: user.email,
    tier: user.tier,
    createdAt: user.createdAt,
    locations: user.locations,
    limits: TIER_LIMITS[user.tier]
  });
});

// ============================================
// WEATHER API ROUTES (UPDATED FOR FREEMIUM)
// ============================================

// Free tier weather endpoint (supports authenticated users with tier from JWT)
app.get('/api/weather', tryAuthenticate, weatherRateLimiter, async (req, res) => {
  const tier = req.user?.tier || 'free';
  await handleWeatherRequest(req, res, tier);
});

// Premium tier weather endpoint
app.get('/api/weather/premium', authenticateToken, checkTier('premium'), async (req, res) => {
  await handleWeatherRequest(req, res, req.user.tier);
});

// Weather data fetcher with tier enforcement
async function handleWeatherRequest(req, res, tier) {
  const { location, unitGroup = 'metric' } = req.query;
  console.log(`[${new Date().toISOString()}] Weather request: ${location} (${unitGroup}) [${tier}]`);

  if (!location) {
    return res.status(400).json({ error: 'Location is required' });
  }

  const isValid = isValidLocation(location);
  if (!isValid) {
    return res.status(400).json({ error: 'Invalid location format' });
  }

  // Check location limit for free tier
  if (tier === 'free') {
    const user = req.user ? users.get(req.user.email) : null;
    if (user && user.locations && user.locations.length >= TIER_LIMITS.free.maxLocations) {
      return res.status(403).json({
        error: 'Location limit reached',
        upgradeRequired: true,
        message: 'Free tier limited to 3 saved locations. Upgrade to premium for unlimited.'
      });
    }
  }

  const locString = String(location);
  const cacheKey = `${locString.toLowerCase()}-${unitGroup}-${tier}`;
  const cachedItem = weatherCache.get(cacheKey);

  if (cachedItem && (Date.now() - cachedItem.timestamp < CACHE_TTL)) {
    weatherCache.delete(cacheKey);
    weatherCache.set(cacheKey, cachedItem);
    return res.json(cachedItem.data);
  }

  const apiKey = process.env.WEATHER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const apiUrl = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${encodeURIComponent(locString)}/next7days?unitGroup=${unitGroup}&key=${apiKey}&contentType=json&include=hours,alerts,current`;
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      const errorText = await response.text();
      return res.status(502).json({ error: 'Weather service unavailable' });
    }

    const data = await response.json();

    // Fetch Air Quality Index (AQI) from Open-Meteo
    let aqi = null;
    if (data.latitude && data.longitude) {
      try {
        const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${data.latitude}&longitude=${data.longitude}&current=us_aqi`;
        const aqiResponse = await fetch(aqiUrl);
        if (aqiResponse.ok) {
          const aqiData = await aqiResponse.json();
          aqi = aqiData?.current?.us_aqi ?? null;
        }
      } catch (err) {
        console.warn('AQI fetch failed:', err);
      }
    }
    data.aqi = aqi;

    // ⚡ Bolt: Aggressively trim unused hourly data to reduce bandwidth and memory footprint
    // Free tier: only needs hourly data for today (index 0)
    // Premium tier: frontend uses hourly data for current and next day (indices 0 and 1)
    if (data.days) {
      const startIndex = tier === 'free' ? 1 : 2;
      for (let i = startIndex; i < data.days.length; i++) {
        if (data.days[i].hours) {
          delete data.days[i].hours;
        }
      }
    }

    // 🎯 Subscription Tier Enforcement: Truncate 7-day forecast for free tier
    const isForecastLimited = tier === 'free';
    if (isForecastLimited && data.days && data.days.length > 3) {
      // Keep only first 3 days for free tier
      data.days = data.days.slice(0, 3);
    }

    // Add tier metadata to response for frontend to handle UI accordingly
    data.tier = tier;
    data.isLimited = isForecastLimited;
    data.upgradeMessage = isForecastLimited ? 'Upgrade to Premium to see full 7-day forecast' : null;

    // Cache the response
    if (weatherCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = weatherCache.keys().next().value;
      weatherCache.delete(oldestKey);
    }

    weatherCache.set(cacheKey, {
      timestamp: Date.now(),
      data
    });

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function isValidLocation(location) {
  if (!location || typeof location !== 'string') return false;
  if (location.length > 200) return false;
  if (location.includes('..')) return false;
  const coordinatePattern = /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/;
  const cityNamePattern = /^[\p{L}\p{N}\s\-.,']+$/u;
  return coordinatePattern.test(location.trim()) || cityNamePattern.test(location.trim());
}

// ============================================
// CACHE AND SERVER
// ============================================

const weatherCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;
const MAX_CACHE_SIZE = 100;

const UPSTREAM_API_ERROR = Object.freeze({
  STATUS: 502,
  MESSAGE: 'Could not retrieve weather data',
});

app.listen(port, () => {
  console.log(`Weather API Server running on port ${port}`);
  console.log(`Authentication enabled: /api/auth/register, /api/auth/login, /api/auth/upgrade`);
  console.log(`Freemium tiers: free (100 calls/day), premium (unlimited)`);
});

export default app;