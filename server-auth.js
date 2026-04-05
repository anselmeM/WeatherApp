// Backend Authentication Module for Weather Dashboard PWA
// Implements Freemium Tier Model with JWT Authentication

import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { blacklistToken, isTokenBlacklisted } from './token-blacklist.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// ============================================
// AUTHENTICATION CONFIGURATION
// ============================================
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';
const SALT_ROUNDS = 10;

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

// In-memory user store (replace with database in production)
const users = new Map();


// ============================================
// MIDDLEWARE
// ============================================
app.use(express.json());

// Serve landing.html as the default page (instead of index.html)
// IMPORTANT: Place this BEFORE express.static to ensure it's hit first
app.get('/', (req, res) => {
  res.sendFile('landing.html', { root: 'public' });
});

app.use(express.static('public', { index: 'landing.html' }));

// 🔐 JWT Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
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

// 🔐 Rate Limit Middleware with Tier Support
function createRateLimiter(tier) {
  const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;
  return rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // Daily limit
    max: limits.maxApiCallsPerDay,
    message: { error: 'Daily API limit reached. Upgrade to premium for unlimited access.' },
    standardHeaders: true,
    legacyHeaders: false,
  });
}

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
    
    // Generate token
    const token = jwt.sign(
      { email: user.email, tier: user.tier },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );
    
    res.status(201).json({
      message: 'Registration successful',
      token,
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
    
    res.json({
      message: 'Login successful',
      token,
      user: { email: user.email, tier: user.tier }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/logout - User Logout (invalidate token)
app.post('/api/auth/logout', authenticateToken, (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (token) {
    // Add token to blacklist to invalidate it
    blacklistToken(token);
  }
  
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
  
  // Generate new token with premium tier
  const token = jwt.sign(
    { email: user.email, tier: user.tier },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
  
  res.json({
    message: 'Upgrade successful!',
    token,
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
app.get('/api/weather', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Daily limit reached. Upgrade to premium for unlimited access.' }
}), async (req, res) => {
  // Check if user is authenticated via JWT, get their tier
  let tier = 'free';
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        tier = decoded.tier || 'free';
      } catch (e) {
        // Invalid token - keep default 'free' tier
      }
    }
  }
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

    // Trim hourly data for free tier to reduce bandwidth
    if (tier === 'free' && data.days) {
      for (let i = 1; i < data.days.length; i++) {
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