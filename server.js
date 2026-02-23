
import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static('public'));

app.get('/api/weather', async (req, res) => {
    const { location, unitGroup = 'metric' } = req.query;
    console.log(`[${new Date().toISOString()}] Weather request: ${location} (${unitGroup})`);

    if (!location) {
        return res.status(400).json({ error: 'Location is required' });
    }

    const apiKey = process.env.WEATHER_API_KEY;
    // Use next7days to limit the payload size.
    const apiUrl = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${encodeURIComponent(location)}/next7days?unitGroup=${unitGroup}&key=${apiKey}&contentType=json&include=hours,alerts,current`;

    try {
        console.log(`[${new Date().toISOString()}] Fetching from: ${apiUrl.replace(apiKey, 'REDACTED')}`);
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[${new Date().toISOString()}] API error (${response.status}): ${errorText}`);
            return res.status(response.status).json({ error: 'Weather API error', details: errorText });
        }

        const data = await response.json();
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
