import express from 'express';
import { securityHeaders, generateCsrfToken, csrfProtection } from './src/middleware.js';
import { pushSchema } from './src/db.js';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import weatherRoutes from './routes/weather.js';
import stripeRoutes from './routes/stripe.js';

const app = express();
const port = process.env.PORT || 3000;

if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(`https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

app.use(securityHeaders);
app.use(express.json({ limit: '10kb' }));
app.use(generateCsrfToken);
app.use('/api', csrfProtection);

// Serve static files from dist (Vite build output) with custom cache-control headers
app.use(express.static('dist', {
  index: 'index.html',
  setHeaders: (res, path) => {
    if (path.endsWith('.html') || path.includes('sw.js')) {
      // Never cache HTML pages or the Service Worker
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else if (path.includes('assets')) {
      // Long-term immutable caching for fingerprinted assets built by Vite
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      // Fallback cache policy for standard files (e.g. manifest, icons)
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  }
}));

app.get('/', (req, res) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  res.sendFile('index.html', { root: 'dist' });
});

app.get('/landing', (req, res) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  res.sendFile('landing.html', { root: 'dist' });
});

app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/stripe', stripeRoutes);

// Run schema push on startup to ensure database tables are synchronized
pushSchema();

app.listen(port, () => {
  console.log(`Weather API Server running on port ${port}`);
  console.log(`Authentication enabled: /api/auth/register, /api/auth/login, /api/auth/upgrade`);
  console.log(`Freemium tiers: free (100 calls/day), premium (unlimited)`);
});

export default app;