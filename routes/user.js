import express from 'express';
import { authenticateToken, requireApiHeader } from '../src/middleware.js';
import { getUser, updateUser } from '../src/db.js';
import { TIER_LIMITS } from '../src/config.js';

const router = express.Router();

router.delete('/locations', requireApiHeader, authenticateToken, async (req, res) => {
  const { email } = req.user;
  const { location } = req.body;
  
  if (!location) {
    return res.status(400).json({ error: 'Location is required' });
  }
  
  const user = await getUser(email);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const targetCity = location.trim().toLowerCase();
  const index = user.locations.findIndex(loc => loc.toLowerCase() === targetCity);
  
  if (index > -1) {
    user.locations.splice(index, 1);
    await updateUser(email, { locations: user.locations });
  }
  
  res.json({
    message: 'Location removed successfully',
    locations: user.locations
  });
});

router.post('/locations', requireApiHeader, authenticateToken, async (req, res) => {
  const { email } = req.user;
  const { location } = req.body;
  
  if (!location) {
    return res.status(400).json({ error: 'Location is required' });
  }
  
  const user = await getUser(email);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const newLoc = location.trim();
  const normalizedLoc = newLoc.toLowerCase();
  
  const isAlreadySaved = user.locations.some(loc => loc.toLowerCase() === normalizedLoc);
  if (isAlreadySaved) {
    return res.json({
      message: 'Location already saved',
      locations: user.locations
    });
  }
  
  if (user.tier === 'free' && user.locations.length >= TIER_LIMITS.free.maxLocations) {
    return res.status(403).json({
      error: 'Location limit reached',
      upgradeRequired: true,
      message: 'Free tier limited to 3 saved locations. Upgrade to premium for unlimited.'
    });
  }
  
  user.locations.push(newLoc);
  await updateUser(email, { locations: user.locations });
  
  res.json({
    message: 'Location saved successfully',
    locations: user.locations
  });
});

export default router;
