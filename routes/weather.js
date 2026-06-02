import express from 'express';
import { tryAuthenticate, authenticateToken, checkTier, weatherRateLimiter } from '../src/middleware.js';
import { handleWeatherRequest } from '../src/weather-service.js';

const router = express.Router();

router.get('/', tryAuthenticate, weatherRateLimiter, async (req, res) => {
  const tier = req.user?.tier || 'free';
  await handleWeatherRequest(req, res, tier);
});

router.get('/premium', authenticateToken, checkTier('premium'), async (req, res) => {
  await handleWeatherRequest(req, res, req.user.tier);
});

export default router;
