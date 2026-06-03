import express from 'express';
import { securityHeaders, generateCsrfToken, csrfProtection } from './src/middleware.js';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import weatherRoutes from './routes/weather.js';

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

// Serve static files from dist (Vite build output)
app.use(express.static('dist', { index: 'landing.html' }));

app.get('/', (req, res) => {
  res.sendFile('landing.html', { root: 'dist' });
});

app.get('/dashboard', (req, res) => {
  res.sendFile('index.html', { root: 'dist' });
});

app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/weather', weatherRoutes);

app.listen(port, () => {
  console.log(`Weather API Server running on port ${port}`);
  console.log(`Authentication enabled: /api/auth/register, /api/auth/login, /api/auth/upgrade`);
  console.log(`Freemium tiers: free (100 calls/day), premium (unlimited)`);
});

export default app;