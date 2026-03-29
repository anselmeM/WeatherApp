import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// 🧹 Code Health: Define constants for upstream API error handling
const UPSTREAM_API_ERROR = Object.freeze({
  STATUS: 502,
  MESSAGE: 'Could not retrieve weather data',
});

// ⚡ Security: Rate limiting to prevent API quota exhaustion
const weatherApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ⚡ Security: Input validation - only allow valid location patterns
function isValidLocation(location) {
  if (!location || typeof location !== 'string') return false;
  if (location.length > 200) return false;
  // Check for path traversal attempts
  if (location.includes('..')) return false;
  // Allow coordinates (e.g., "40.7,-74.0") or city names
  const coordinatePattern = /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/;
  const cityNamePattern = /^[\p{L}\p{N}\s\-.,']+$/u;
  return coordinatePattern.test(location.trim()) || cityNamePattern.test(location.trim());
}

app.use(express.static('public'));

// Serve landing.html as the default page (instead of index.html)
app.get('/', (req, res) => {
  res.sendFile('landing.html', { root: 'public' });
});

// ⚡ Bolt: Simple in-memory cache for weather data to reduce external API calls
const weatherCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const MAX_CACHE_SIZE = 100; // Prevent memory exhaustion

// 🛡️ Security: Apply rate limiter to weather API endpoint
app.get('/api/weather', weatherApiLimiter, async (req, res) => {
  const { location, unitGroup = 'metric' } = req.query;
  console.log(`[${new Date().toISOString()}] Weather request: ${location} (${unitGroup})`);

  if (!location) {
    return res.status(400).json({ error: 'Location is required' });
  }

  // 🛡️ Security: Validate location input to prevent injection
  if (!isValidLocation(location)) {
    console.warn(`[${new Date().toISOString()}] Invalid location input rejected: ${location}`);
    return res.status(400).json({ error: 'Invalid location format. Please enter a valid city name or coordinates.' });
  }

  const locString = typeof location === 'string' ? location : String(location);
  const cacheKey = `${locString.toLowerCase()}-${unitGroup}`;
  const cachedItem = weatherCache.get(cacheKey);

  if (cachedItem && (Date.now() - cachedItem.timestamp < CACHE_TTL)) {
    console.log(`[${new Date().toISOString()}] Cache hit for: ${cacheKey}`);
    weatherCache.delete(cacheKey);
    weatherCache.set(cacheKey, cachedItem);
    return res.json(cachedItem.data);
  }

  // 🛡️ Security: API key stored server-side in env variable (never exposed to client)
  const apiKey = process.env.WEATHER_API_KEY;
  if (!apiKey) {
    console.error('WEATHER_API_KEY not configured in environment');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    // Build API URL server-side (key never exposed to client)
    const apiUrl = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${encodeURIComponent(locString)}/next7days?unitGroup=${unitGroup}&key=${apiKey}&contentType=json&include=hours,alerts,current`;
    console.log(`[${new Date().toISOString()}] Fetching weather data (key hidden)`);
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${new Date().toISOString()}] API error (${response.status}): ${errorText.substring(0, 200)}`);
      
      if (response.status === 429 || errorText.includes('quota')) {
        return res.status(429).json({ error: 'Weather service quota exceeded. Please try again later.' });
      }
      
      return res.status(UPSTREAM_API_ERROR.STATUS).json({ error: UPSTREAM_API_ERROR.MESSAGE });
    }

    const data = await response.json();

    // Trim unused hourly data from future days to reduce payload size
    if (data && data.days) {
      for (let i = 1; i < data.days.length; i++) {
        if (data.days[i].hours) {
          delete data.days[i].hours;
        }
      }
    }

    // Cache the successful response and enforce size limit
    if (weatherCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = weatherCache.keys().next().value;
      weatherCache.delete(oldestKey);
    }

    weatherCache.set(cacheKey, {
      timestamp: Date.now(),
      data: data
    });

    console.log(`[${new Date().toISOString()}] Success: Data received for ${data.resolvedAddress}`);
    res.json(data);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Server error:`, error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
