// Backend Authentication Module for Weather Dashboard PWA
// Implements Freemium Tier Model with JWT Authentication

import express from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { blacklistToken } from './token-blacklist.js';

import {
  JWT_SECRET,
  JWT_EXPIRY,
  SALT_ROUNDS,
  COOKIE_MAX_AGE_FLAGS,
  COOKIE_CLEAR_FLAGS,
  TIER_LIMITS
} from './src/config.js';

import { users, saveUsers } from './src/db.js';

import {
  authenticateToken,
  checkTier,
  tryAuthenticate,
  weatherRateLimiter,
  securityHeaders,
  getCookieToken
} from './src/middleware.js';

import { handleWeatherRequest } from './src/weather-service.js';

const app = express();
const port = process.env.PORT || 3000;

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

// Basic Security Headers
app.use(securityHeaders);
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

// POST /api/auth/downgrade - Downgrade to Free Tier (Cancel Premium Sub)
app.post('/api/auth/downgrade', authenticateToken, async (req, res) => {
  const { email } = req.user;
  const user = users.get(email);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // Downgrade to free and truncate saved locations to 3
  user.tier = 'free';
  if (user.locations && user.locations.length > TIER_LIMITS.free.maxLocations) {
    user.locations = user.locations.slice(0, TIER_LIMITS.free.maxLocations);
  }
  users.set(email, user);
  saveUsers(); // Persist users database
  
  // Generate new token with free tier
  const token = jwt.sign(
    { email: user.email, tier: user.tier },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
  
  res.setHeader('Set-Cookie', `weather_auth_token=${token}; ${COOKIE_MAX_AGE_FLAGS}`);
  res.json({
    message: 'Subscription cancelled. Downgraded to Free Tier.',
    user: { email: user.email, tier: user.tier },
    locations: user.locations
  });
});

// DELETE /api/user/locations - Remove a saved location from profile
app.delete('/api/user/locations', authenticateToken, (req, res) => {
  const { email } = req.user;
  const { location } = req.body;
  
  if (!location) {
    return res.status(400).json({ error: 'Location is required' });
  }
  
  const user = users.get(email);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const targetCity = location.trim().toLowerCase();
  const index = user.locations.findIndex(loc => loc.toLowerCase() === targetCity);
  
  if (index > -1) {
    user.locations.splice(index, 1);
    saveUsers();
  }
  
  res.json({
    message: 'Location removed successfully',
    locations: user.locations
  });
});

// POST /api/user/locations - Pin/save a location
app.post('/api/user/locations', authenticateToken, (req, res) => {
  const { email } = req.user;
  const { location } = req.body;
  
  if (!location) {
    return res.status(400).json({ error: 'Location is required' });
  }
  
  const user = users.get(email);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const newLoc = location.trim();
  const normalizedLoc = newLoc.toLowerCase();
  
  // Check if already saved
  const isAlreadySaved = user.locations.some(loc => loc.toLowerCase() === normalizedLoc);
  if (isAlreadySaved) {
    return res.json({
      message: 'Location already saved',
      locations: user.locations
    });
  }
  
  // Check limit for free tier
  if (user.tier === 'free' && user.locations.length >= TIER_LIMITS.free.maxLocations) {
    return res.status(403).json({
      error: 'Location limit reached',
      upgradeRequired: true,
      message: 'Free tier limited to 3 saved locations. Upgrade to premium for unlimited.'
    });
  }
  
  user.locations.push(newLoc);
  saveUsers();
  
  res.json({
    message: 'Location saved successfully',
    locations: user.locations
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
// WEATHER API ROUTES
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

app.listen(port, () => {
  console.log(`Weather API Server running on port ${port}`);
  console.log(`Authentication enabled: /api/auth/register, /api/auth/login, /api/auth/upgrade`);
  console.log(`Freemium tiers: free (100 calls/day), premium (unlimited)`);
});

export default app;