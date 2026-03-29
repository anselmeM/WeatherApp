# Weather Dashboard PWA - Technical Design Blueprint

## 1. Architecture Overview

### 1.1 System Architecture Diagram

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────────┐
│   Client        │         │   Server        │         │   External APIs    │
│   (Browser)    │◄───────►│   (Node.js)     │◄───────►│   (Visual Crossing) │
│                │  HTTP   │   Express       │  HTTPS  │   (Open-Meteo)     │
│  ┌──────────┐  │         │  ┌──────────┐  │         │   (BigDataCloud)   │
│  │ PWA      │  │         │  │ API      │  │         │   (Wikipedia)      │
│  │ Shell    │  │         │  │ Proxy    │  │         │                    │
│  └──────────┘  │         │  └──────────┘  │         └─────────────────────┘
│  ┌──────────┐  │         │  ┌──────────┐  │
│  │ Service  │  │         │  │ Weather  │  │
│  │ Worker   │  │         │  │ Cache    │  │
│  └──────────┘  │         │  └──────────┘  │
└─────────────────┘         └──────────────────┘
```

### 1.2 Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Runtime | Node.js | ≥18.x |
| Framework | Express.js | ^4.18 |
| Frontend | HTML5, CSS3, JavaScript (ES2022) | - |
| Styling | Tailwind CSS (CDN) | v3.x |
| PWA | Service Worker API | - |
| Weather API | Visual Crossing Weather API | v2024 |
| Geocoding | Open-Meteo Geocoding API | v1 |
| Reverse Geo | BigDataCloud API | v1 |
| Caching | Browser Cache API, Express Memory | - |

---

## 2. UI/UX Specification

### 2.1 Layout Structure

```
┌─────────────────────────────────────────────────────┐
│  [Loading Overlay - Full Screen]                  │
│  [Weather Alert Banner - Top]                      │
│                                                     │
│  ┌─────────────────────┐ ┌───────────────────────┐ │
│  │  LEFT PANEL         │ │  RIGHT PANEL           │ │
│  │  (Search Bar)       │ │  [Today] [Week]       │ │
│  │  (Recent Searches)  │ │  [°C] [°F] [Theme]    │ │
│  │                     │ │                       │ │
│  │  [Weather Icon]     │ │  ┌─────────────────┐   │ │
│  │  12°C               │ │  │ 24-Hour Chart  │   │ │
│  │  Feels like 10°C    │ │  └─────────────────┘   │ │
│  │  Monday, 16:00      │ │  ┌─────────────────┐   │ │
│  │                     │ │  │ Hourly Cards    │   │ │
│  │  Mostly Cloudy      │ │  └─────────────────┘   │ │
│  │  Rain - 30%         │ │                       │ │
│  │                     │ │  7-Day Forecast Grid  │ │
│  │  [City Image]       │ │                       │ │
│  │  New York, NY        │ │  Weather Highlights    │ │
│  └─────────────────────┘ │  (UV, Wind, Sun, Hum,  │ │
│                          │   Visibility, Air)      │ │
│                          └───────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 2.2 Responsive Breakpoints

| Breakpoint | Width | Layout |
|-----------|-------|--------|
| xs | <640px | Single column, stacked panels |
| sm | ≥640px | Single column with larger elements |
| md | ≥768px | Beginning of side-by-side |
| lg | ≥1024px | Left (1/3) + Right (2/3) panels |
| xl | ≥1280px | Full width with max-width container |
| 2xl | ≥1536px | Centered max-width 7xl |

### 2.3 Visual Design

#### Color Palette

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|----------|-------|
| `--bg-clear` | linear-gradient(#ffd700, #ff8c00) | linear-gradient(#1e3c72, #2a5298) | Clear sky background |
| `--bg-cloudy` | linear-gradient(#bdc3c7, #2c3e50) | linear-gradient(#141e30, #243b55) | Cloudy background |
| `--bg-rain` | linear-gradient(#4b6cb7, #182848) | linear-gradient(#0f2027, #2c5364) | Rain background |
| `--bg-snow` | linear-gradient(#e0eafc, #cfdef3) | linear-gradient(#2c3e50, #3498db) | Snow background |
| `--bg-storm` | linear-gradient(#1e1e1e, #434343) | linear-gradient(#000000, #434343) | Storm background |
| `--glass-bg` | rgba(255, 255, 255, 0.4) | rgba(31, 41, 55, 0.4) | Dashboard panel |
| `--glass-border` | rgba(255, 255, 255, 0.2) | rgba(255, 255, 255, 0.1) | Panel borders |
| Primary | #3b82f6 (blue-500) | #3b82f6 | Buttons, highlights |
| Accent | #fbbf24 (amber-400) | #fbbf24 | Sun icons |
| Text Primary | #1f2937 (gray-800) | #ffffff | Main text |
| Text Secondary | #6b7280 (gray-500) | #9ca3af (gray-400) | Subdued text |

#### Typography

| Element | Font | Weight | Size |
|---------|------|--------|------|
| Body | Poppins | 400 | 16px |
| Headings | Poppins | 600-700 | 18-32px |
| Temperature | Poppins | 700 | 72-96px |
| Labels | Poppins | 500 | 14px |
| Kbd | monospace | 400 | 12px |

#### Spacing System (Tailwind-based)

- Base unit: 4px
- Container padding: 16px (sm), 32px (md/lg)
- Card padding: 20px-32px
- Grid gap: 16px (grid-cols-2), 24px (grid-cols-3)
- Section margins: 24px-32px

#### Visual Effects

| Effect | CSS Property |
|--------|-------------|
| Glassmorphism | backdrop-filter: blur(12px) saturate(180%) |
| Card shadows | box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) |
| Hover lift | transform: translateY(-4px) scale(1.02) |
| Icon pulse | animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite |
| Loading spin | animation: spin 1s linear infinite |
| Fade in | animation: fadeIn 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards |
| Chart line | stroke: #3b82f6, stroke-width: 3, filter: drop-shadow |

---

## 3. Component Specification

### 3.1 Core Components

| Component | States | Interactions | ARIA |
|-----------|--------|-------------|-----|
| SearchInput | default, focused, loading, error | input, keydown, click autocomplete | aria-label, aria-expanded |
| RecentSearchPill | default, hover, active | click to search | - |
| GeolocationButton | default, loading, error, disabled | click to get location | aria-label |
| TemperatureDisplay | default, updating | - | - |
| WeatherIcon | default, animating | - | role="img" |
| ForecastCard | default, hover, selected | click (future) | role="article" |
| UnitToggle | celsius-active, fahrenheit-active | click to toggle | aria-pressed |
| ThemeToggle | light, dark | click to toggle | aria-pressed |
| TabButton | default, active | click to switch | aria-selected |
| AlertBanner | hidden, visible, dismissing | click to close | role="alert", aria-live |
| HourlyCard | default, hover, now-indicator | - | role="article" |
| HighlightCard | default, hover | - | role="group" |
| ErrorToast | hidden, visible, dismissing | auto-dismiss | role="alert" |

### 3.2 Component Hierarchy

```
WeatherDashboard
├── LoadingOverlay
├── WeatherAlertBanner
└── MainContainer
    ├── LeftPanel
    │   ├── SearchBar
    │   │   ├── SearchInput
    │   │   ├── AutocompleteDropdown
    │   │   └── GeolocationButton
    │   ├── RecentSearchesContainer
    │   └── CurrentWeatherView
    │       ├── WeatherIcon
    │       ├── TemperatureDisplay
    │       ├── ConditionView
    │       └── CityImageCard
    └── RightPanel
        ├── Toolbar
        │   ├── TodayWeekTabs
        │   └── SettingsGroup
        │       ├── ThemeToggle
        │       └── UnitToggle
        └── ForecastViews
            ├── HourlyForecastSection
            │   ├── TemperatureChart
            │   └── HourlyCardList
            └── WeeklyForecastSection
                └── ForecastGrid
        └── HighlightsSection
            └── HighlightsGrid
```

---

## 4. Data Architecture

### 4.1 API Contracts

#### GET /api/weather

**Request**
```
GET /api/weather?location=<string>&unitGroup=<metric|us>

Headers:
  Accept: application/json
```

**Response (200)**
```json
{
  "latitude": 40.7128,
  "longitude": -74.006,
  "resolvedAddress": "New York, NY, USA",
  "address": "New York, NY, USA",
  "timezone": "America/New_York",
  "tzoffset": -4,
  "currentConditions": {
    "datetime": "16:00:00",
    "datetimeEpoch": 1710787200,
    "temp": 12.3,
    "feelslike": 10.1,
    "humidity": 65,
    "dew": 5.6,
    "pressure": 1013,
    "winddir": 180,
    "windspeed": 15.3,
    "visibility": 10,
    "cloudcover": 75,
    "icon": "partly-cloudy-day",
    "conditions": "Partly Cloudy"
  },
  "days": [
    {
      "datetime": "2024-03-29",
      "datetimeEpoch": 1710729600,
      "tempmax": 15.2,
      "tempmin": 8.4,
      "precipprob": 30,
      "uvindex": 5,
      "sunrise": "06:45",
      "sunset": "19:15",
      "icon": "partly-cloudy-day",
      "conditions": "Partly Cloudy",
      "hours": [...]
    }
  ],
  "alerts": [...]
}
```

**Error Responses**
- 400: `{ "error": "Location is required" }`
- 502: `{ "error": "Could not retrieve weather data" }`
- 500: `{ "error": "Internal server error" }`

### 4.2 Client State

```typescript
interface AppState {
  unitGroup: 'metric' | 'us';
  currentWeatherData: WeatherData | null;
  isInitialLoad: boolean;
  recentSearches: string[];
  currentTheme: 'light' | 'dark';
}
```

### 4.3 LocalStorage Schema

| Key | Type | Description |
|-----|------|-------------|
| `unitGroup` | string | "metric" or "us" |
| `recentSearches` | JSON string array | Max 5 city names |
| `theme` | string | "light" or "dark" |

### 4.4 Service Worker Cache Schema

| Cache Name | Version | Contents |
|-----------|---------|---------|
| weather-dashboard-cache | v10 | HTML, CSS, JS, Fonts, manifest.json |

---

## 5. Server Architecture

### 5.1 Route Handlers

| Route | Method | Handler |
|-------|--------|---------|
| `/` | GET | Serve static index.html |
| `/api/weather` | GET | Weather proxy with caching |
| `/*` | GET | Serve static files |

### 5.2 Middleware

```javascript
app.use(express.static('public'));  // Static file serving
```

### 5.3 Server-Side Caching

- In-memory Map cache for weather responses
- Cache TTL: 10 minutes
- Max entries: 100
- Eviction: FIFO (oldest first)

---

## 6. Service Worker Strategy

### 6.1 Caching Strategy

| Request Type | Strategy | Rationale |
|-------------|----------|-----------|
| App Shell | Cache First | Fast load, offline available |
| Weather API | Network First | Fresh data preferred |
| External Fonts | Cache First | Rarely change |
| City Images | Network First | May change |

### 6.2 Lifecycle Events

```
install → activate → fetch (cache match → network)
```

### 6.3 Cache Version

- Current Version: `weather-dashboard-cache-v10`
- Update on any static file change

---

## 7. Security Specification

### 7.1 API Protection

| Measure | Implementation |
|---------|--------------|
| Key Storage | Environment variable, never in code |
| Request Proxy | Server-side only, key never in client URL |
| Rate Limiting | 100 requests per 15 minutes per IP |

### 7.2 Input Validation

```javascript
// Location validation
const locationRegex = /^[\p{L}\s\-.,0-9]+$/u;
if (!locationRegex.test(location)) {
  return res.status(400).json({ error: 'Invalid location format' });
}
```

### 7.3 CSP Headers (Recommended Future Addition)

```
Content-Security-Policy:
  default-src 'self';
  img-src 'self' https://*.wikimedia.org https://placehold.co;
  connect-src 'self' https://geocoding-api.open-meteo.com https://api.bigdatacloud.net;
  font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com;
```

---

## 8. Performance Specification

### 8.1 Targets

| Metric | Target | Current |
|--------|--------|--------|
| First Contentful Paint | <1.5s | ~800ms |
| Largest Contentful Paint | <2.5s | ~1.8s |
| Time to Interactive | <3.5s | ~2.0s |
| Cumulative Layout Shift | <0.1 | <0.1 |
| First Input Delay | <100ms | <50ms |

### 8.2 Optimizations Implemented

- DocumentFragment batching for DOM appends
- LRU cache for autocomplete results
- Image cache with max 50 entries
- Service worker preload
- Skeleton loading states
- Debounced search input (300ms)
- AbortController for network timeouts (15s)

### 8.3 Recommended Optimizations

- Stale-while-revalidate for weather data
- IntersectionObserver for chart lazy-load
- content-visibility for off-screen cards

---

## 9. Accessibility Specification

### 9.1 WCAG 2.1 AA Compliance Targets

| Requirement | Implementation |
|-------------|--------------|
| Color Contrast | ≥4.5:1 for text, ≥3:1 for large text |
| Keyboard Navigation | All interactive elements focusable |
| Screen Reader | ARIA labels, live regions |
| Focus Indicators | Visible :focus-visible styles |
| Motion | Respect prefers-reduced-motion |
| Text Scaling | Works up to 200% zoom |

### 9.2 ARIA Implementation

| Element | ARIA Attributes |
|---------|---------------|
| Search Input | aria-label="Search for a city", aria-expanded |
| Autocomplete List | role="listbox" |
| Autocomplete Item | role="option" |
| Alert Banner | role="alert", aria-live="polite" |
| Error Toast | role="alert", aria-live="assertive" |
| Tab Panel | role="tablist" |
| Tab Button | aria-selected, aria-controls |
| Temperature Chart |aria-label, role="img" with description |

---

## 10. File Structure

```
WeatherApp/
├── server.js                 # Express server + API proxy
├── package.json           # Dependencies
├── .env                # Environment variables (API key)
├── public/
│   ├── index.html      # Main HTML entry
│   ├── script.js    # Main application logic
│   ├── style.css   # Custom styles
│   ├── utils.js    # Helper functions
│   ├── chart.js   # SVG chart rendering
│   ├── manifest.json   # PWA manifest
│   └── service-worker.js  # Service worker
├── .roo/
│   ├── requirements.md  # This file
│   ├── design.md     # Design template
│   └── tasks.md     # Implementation tasks
└── README.md
```

---

## 11. Implementation Notes

### 11.1 Known Limitations

1. Air quality is simulated (no real AQ API integration)
2. Weather alerts display only first alert
3. No deep linking (URL doesn't reflect location)
4. No browser history integration
5. Unit toggle requires API refetch

### 11.2 Future Considerations (Phase 2)

1. Push notification service
2. Multiple location comparison
3. Historical weather data
4. Share API integration
5. Freemium tier with subscriptions