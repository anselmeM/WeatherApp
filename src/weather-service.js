import fetch from 'node-fetch';

const weatherCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;
const MAX_CACHE_SIZE = 100;

// ⚡ Bolt: Cache regular expressions at module scope to avoid re-compilation
const COORDINATE_PATTERN = /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/;
const CITY_NAME_PATTERN = /^[\p{L}\p{N}\s\-.,']+$/u;

export function isValidLocation(location) {
  if (!location || typeof location !== 'string') return false;
  if (location.length > 200) return false;
  if (location.includes('..')) return false;
  return COORDINATE_PATTERN.test(location.trim()) || CITY_NAME_PATTERN.test(location.trim());
}

export async function handleWeatherRequest(req, res, tier) {
  const { location, unitGroup = 'metric' } = req.query;
  console.log(`[${new Date().toISOString()}] Weather request: ${location} (${unitGroup}) [${tier}]`);

  if (!location) {
    return res.status(400).json({ error: 'Location is required' });
  }

  const isValid = isValidLocation(location);
  if (!isValid) {
    return res.status(400).json({ error: 'Invalid location format' });
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
      return res.status(520).json({ error: 'Weather service unavailable' });
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
    if (isForecastLimited) {
      if (data.days && data.days.length > 3) {
        // Keep only first 3 days for free tier
        data.days = data.days.slice(0, 3);
      }
      if (data.alerts) {
        delete data.alerts;
      }
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
