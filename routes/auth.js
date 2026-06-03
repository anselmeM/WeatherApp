import express from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { blacklistToken } from '../token-blacklist.js';
import {
  JWT_SECRET,
  JWT_EXPIRY,
  SALT_ROUNDS,
  TIER_LIMITS
} from '../src/config.js';
import { getUser, createUser, updateUser } from '../src/db.js';
import { authenticateToken, getCookieToken, requireApiHeader } from '../src/middleware.js';

const router = express.Router();

router.get('/csrf', (req, res) => {
  res.json({ success: true });
});

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'Strict',
  path: '/',
  maxAge: 24 * 60 * 60 * 1000 // 24 hours
};

const clearCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'Strict',
  path: '/',
  maxAge: 0
};

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please try again later.' }
});

const RegisterSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters')
});

const LoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
});

router.post('/register', requireApiHeader, rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many registration attempts. Please try again later.' }
}), async (req, res) => {
  try {
    const validation = RegisterSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.errors[0].message });
    }
    const { email, password } = validation.data;
    
    const existingUser = await getUser(email);
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    
    const user = {
      email: email.toLowerCase(),
      password: hashedPassword,
      tier: 'free',
      createdAt: new Date().toISOString(),
      locations: [],
      apiCalls: 0
    };
    
    await createUser(user);
    
    const token = jwt.sign(
      { email: user.email, tier: user.tier },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );
    
    res.cookie('weather_auth_token', token, cookieOptions);
    res.status(201).json({
      message: 'Registration successful',
      user: { email: user.email, tier: user.tier }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', requireApiHeader, loginLimiter, async (req, res) => {
  try {
    const validation = LoginSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.errors[0].message });
    }
    const { email, password } = validation.data;
    
    const user = await getUser(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { email: user.email, tier: user.tier },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );
    
    res.cookie('weather_auth_token', token, cookieOptions);
    res.json({
      message: 'Login successful',
      user: { email: user.email, tier: user.tier }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/logout', requireApiHeader, authenticateToken, (req, res) => {
  const token = getCookieToken(req);
  
  if (token) {
    const expiresAt = req.user && req.user.exp ? req.user.exp * 1000 : null;
    blacklistToken(token, expiresAt);
  }
  
  res.cookie('weather_auth_token', '', clearCookieOptions);
  res.json({ message: 'Logout successful' });
});

router.post('/upgrade', requireApiHeader, authenticateToken, async (req, res) => {
  const { email } = req.user;
  const user = await getUser(email);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  await updateUser(email, { tier: 'premium' });
  
  const token = jwt.sign(
    { email: user.email, tier: 'premium' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
  
  res.cookie('weather_auth_token', token, cookieOptions);
  res.json({
    message: 'Upgrade successful!',
    user: { email: user.email, tier: 'premium' }
  });
});

router.post('/downgrade', requireApiHeader, authenticateToken, async (req, res) => {
  const { email } = req.user;
  const user = await getUser(email);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  let newLocations = user.locations;
  if (newLocations && newLocations.length > TIER_LIMITS.free.maxLocations) {
    newLocations = newLocations.slice(0, TIER_LIMITS.free.maxLocations);
  }
  
  await updateUser(email, { tier: 'free', locations: newLocations });
  
  const token = jwt.sign(
    { email: user.email, tier: 'free' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
  
  res.cookie('weather_auth_token', token, cookieOptions);
  res.json({
    message: 'Subscription cancelled. Downgraded to Free Tier.',
    user: { email: user.email, tier: 'free' },
    locations: newLocations
  });
});

router.get('/profile', authenticateToken, async (req, res) => {
  const { email } = req.user;
  const user = await getUser(email);
  
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

export default router;
