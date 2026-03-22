
import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// 🧹 Code Health: Define constants for upstream API error handling
const UPSTREAM_API_ERROR = Object.freeze({
  STATUS: 502,
  MESSAGE: 'Could not retrieve weather data',
});

app.use(express.static('public'));

// ⚡ Bolt: Simple in-memory cache for weather data to reduce external API calls
const weatherCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const MAX_CACHE_SIZE = 100; // Prevent memory exhaustion

app.get('/api/weather', async (req, res) => {
    const { location, unitGroup = 'metric' } = req.query;
    console.log(`[${new Date().toISOString()}] Weather request: ${location} (${unitGroup})`);

    if (!location) {
        return res.status(400).json({ error: 'Location is required' });
    }

    // Ensure location is a string to prevent TypeError if it's an array
    const locString = typeof location === 'string' ? location : String(location);
    const cacheKey = `${locString.toLowerCase()}-${unitGroup}`;
    const cachedItem = weatherCache.get(cacheKey);

    if (cachedItem && (Date.now() - cachedItem.timestamp < CACHE_TTL)) {
        console.log(`[${new Date().toISOString()}] Cache hit for: ${cacheKey}`);
        // ⚡ Bolt: Refresh item for LRU eviction policy to optimize cache hit rates
        weatherCache.delete(cacheKey);
        weatherCache.set(cacheKey, cachedItem);
        return res.json(cachedItem.data);
    }

    const apiKey = process.env.WEATHER_API_KEY;
    // Use next7days to limit the payload size.
    // ⚡ Bolt: Use sanitized locString for consistency with cache key
    const apiUrl = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${encodeURIComponent(locString)}/next7days?unitGroup=${unitGroup}&key=${apiKey}&contentType=json&include=hours,alerts,current`;

    try {
        console.log(`[${new Date().toISOString()}] Fetching from: ${apiUrl.replace(apiKey, 'REDACTED')}`);
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[${new Date().toISOString()}] API error (${response.status}): ${errorText}`);
            return res.status(UPSTREAM_API_ERROR.STATUS).json({ error: UPSTREAM_API_ERROR.MESSAGE });
        }

        const data = await response.json();

        // ⚡ Bolt: Trim unused hourly data from future days to reduce payload size
        if (data && data.days) {
            for (let i = 1; i < data.days.length; i++) {
                if (data.days[i].hours) {
                    delete data.days[i].hours;
                }
            }
        }

        // ⚡ Bolt: Cache the successful response and enforce size limit
        if (weatherCache.size >= MAX_CACHE_SIZE) {
            // Simple eviction: remove the oldest item (first inserted in Map)
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
        console.error(`[${new Date().toISOString()}] Server error:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
