import fetch from 'node-fetch';

const weatherCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;
const MAX_CACHE_SIZE = 100;

export function isValidLocation(location) {
  if (!location || typeof location !== 'string') return false;
  if (location.length > 200) return false;
  if (location.includes('..')) return false;
  const coordinatePattern = /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/;
  const cityNamePattern = /^[\p{L}\p{N}\s\-.,']+$/u;
  return coordinatePattern.test(location.trim()) || cityNamePattern.test(location.trim());
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
  if (!apiKey || apiKey === 'YOUR_KEY_HERE') {
    return res.json(generateMockWeather(locString, unitGroup, tier));
  }

  try {
    const apiUrl = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${encodeURIComponent(locString)}/next7days?unitGroup=${unitGroup}&key=${apiKey}&contentType=json&include=hours,alerts,current`;
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      console.warn(`Visual Crossing returned ${response.status}, falling back to mock data`);
      return res.json(generateMockWeather(locString, unitGroup, tier));
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

function seededRandom(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

function generateMockWeather(location, unitGroup, tier) {
  const cleanLoc = location.replace(/^[\d.,\s-]+/, '').trim() || 'Unknown Location';
  const cityName = cleanLoc.split(',')[0] || cleanLoc;
  const rand = seededRandom(cityName.split('').reduce((a, c) => a + c.charCodeAt(0), 0));

  const tempBase = unitGroup === 'us' ? 75 : 24;
  const tempRange = 8;
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  const makeDay = (offset) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    const ds = d.toISOString().split('T')[0];
    const baseSum = cityName.length + offset * 7;
    const max = tempBase + Math.floor((baseSum % 12) - 4);
    const min = max - Math.floor(5 + (baseSum % 6));
    const icons = ['clear-day','partly-cloudy-day','cloudy','rain','partly-cloudy-day','clear-day','clear-day'];
    const icon = icons[offset % icons.length];

    const hours = [];
    for (let h = 0; h < 24; h++) {
      const hourTemp = min + ((max - min) * (0.3 + 0.7 * Math.sin((h - 6) * Math.PI / 12)));
      hours.push({
        datetime: `${String(h).padStart(2, '0')}:00:00`,
        temp: Math.round(hourTemp * 10) / 10,
        icon: h >= 6 && h <= 20 ? icon : 'clear-night',
        precipprob: icon.includes('rain') ? 40 + Math.floor(rand() * 40) : (icon === 'cloudy' ? 15 + Math.floor(rand() * 25) : Math.floor(rand() * 15)),
      });
    }

    return {
      datetime: ds,
      tempmax: max,
      tempmin: min,
      icon,
      precipprob: icon.includes('rain') ? 55 + Math.floor(rand() * 35) : (icon === 'cloudy' ? 20 + Math.floor(rand() * 30) : Math.floor(rand() * 15)),
      sunrise: `0${5 + (offset % 2)}:${String(30 + (offset % 30)).padStart(2, '0')}:00`,
      sunset: `${19 + (offset % 2)}:${String(15 + (offset % 30)).padStart(2, '0')}:00`,
      uvindex: Math.floor((max - tempBase + 10) * 0.8),
      hours,
    };
  };

  const days = [];
  for (let i = 0; i < 7; i++) days.push(makeDay(i));

  const current = days[0].hours[now.getHours()];

  const data = {
    resolvedAddress: cleanLoc,
    address: cleanLoc,
    latitude: 40.7128 + rand() * 2 - 1,
    longitude: -74.006 + rand() * 2 - 1,
    currentConditions: {
      temp: current.temp,
      feelslike: Math.round((current.temp + (current.temp > tempBase + 5 ? 2 : -1)) * 10) / 10,
      humidity: 45 + Math.floor(rand() * 40),
      windspeed: 5 + Math.round((rand() * 20) * 10) / 10,
      winddir: Math.floor(rand() * 360),
      visibility: 5 + Math.round(rand() * 12),
      uvindex: days[0].uvindex,
      icon: current.icon,
      conditions: current.icon.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      sunrise: days[0].sunrise,
      sunset: days[0].sunset,
      precipprob: current.precipprob,
      pressure: 1010 + Math.floor(rand() * 20),
      dew: Math.round((current.temp - 5 + rand() * 3) * 10) / 10,
    },
    days,
    aqi: 30 + Math.floor(rand() * 150),
    alerts: [],
  };

  // Apply tier restrictions
  const isLimited = tier === 'free';
  if (isLimited && data.days.length > 3) {
    for (let i = 3; i < data.days.length; i++) {
      delete data.days[i].hours;
    }
  }
  if (isLimited) {
    data.days = data.days.slice(0, 3);
    delete data.alerts;
  }
  data.tier = tier;
  data.isLimited = isLimited;
  data.upgradeMessage = isLimited ? 'Upgrade to Premium to see full 7-day forecast' : null;

  return data;
}
