import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Search, MapPin, ChevronUp, ChevronDown, Wind, X, Loader2, Bookmark, BookmarkCheck, Sun, Moon, RefreshCw, Compass, Navigation } from 'lucide-react';
import { useWeather } from './hooks/useWeather';

// ─── Animated Counter ───────────────────────────────────────────

function AnimatedCounter({ value, suffix = '', duration = 600, className = '' }) {
  const [display, setDisplay] = useState(value ?? 0);
  const prevRef = useRef(value);

  useEffect(() => {
    if (value == null) { setDisplay('--'); return; }
    const start = prevRef.current ?? 0;
    const end = value;
    prevRef.current = end;
    const startTime = performance.now();

    let raf;
    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = progress * (2 - progress);
      const current = start + eased * (end - start);
      setDisplay(Number.isInteger(end) ? Math.round(current) : current.toFixed(1));
      if (progress < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span className={className}>{display}{suffix}</span>;
}

// ─── Helpers ────────────────────────────────────────────────────

function getWindDir(deg) {
  if (deg == null) return '--';
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16] || 'N';
}

function fmtTime(str) {
  if (!str) return '--:--';
  const m = str.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return str;
  const h = parseInt(m[1]), min = m[2];
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${min} ${ampm}`;
}

function fmtDate(datetime) {
  return new Date(datetime + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' });
}

function fmtLastUpdated(date) {
  if (!date) return '';
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function aqiLabel(aqi) {
  if (aqi == null) return { label: '--', emoji: '--', bar: 0, color: 'bg-gray-400' };
  if (aqi <= 50)  return { label: 'Good', emoji: '😊', bar: aqi / 50 * 100, color: 'bg-green-500' };
  if (aqi <= 100) return { label: 'Moderate', emoji: '🤙', bar: (aqi - 50) / 50 * 33 + 33, color: 'bg-yellow-500' };
  if (aqi <= 150) return { label: 'Unhealthy', emoji: '🙁', bar: (aqi - 100) / 50 * 33 + 66, color: 'bg-orange-500' };
  return { label: 'Hazardous', emoji: '☠️', bar: 85, color: 'bg-red-500' };
}

function getWeatherTint(icon) {
  const c = (icon || '').toLowerCase();
  const tints = {
    light: {
      clear: 'bg-amber-50/30',
      cloudy: 'bg-gray-100/50',
      rain: 'bg-blue-50/50',
      snow: 'bg-cyan-50/30',
      storm: 'bg-purple-50/30',
      night: 'bg-indigo-50/30',
    },
    dark: {
      clear: 'bg-amber-950/20',
      cloudy: 'bg-gray-900',
      rain: 'bg-blue-950/25',
      snow: 'bg-cyan-950/20',
      storm: 'bg-purple-950/20',
      night: 'bg-indigo-950/20',
    }
  };
  const mode = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  if (c.includes('rain') || c.includes('shower') || c.includes('drizzle')) return tints[mode].rain;
  if (c.includes('snow') || c.includes('ice') || c.includes('sleet')) return tints[mode].snow;
  if (c.includes('storm') || c.includes('thunder')) return tints[mode].storm;
  if (c.includes('cloud') || c.includes('overcast')) return tints[mode].cloudy;
  if (c.includes('night')) return tints[mode].night;
  return tints[mode].clear;
}

// ─── Toast ──────────────────────────────────────────────────────

function Toast({ message, type, onDismiss }) {
  if (!message) return null;
  const bg = { error: 'bg-red-500', success: 'bg-green-500', info: 'bg-gray-900 dark:bg-gray-100 dark:text-gray-900' }[type] || 'bg-gray-900';
  return (
    <div className={`fixed top-4 right-4 z-50 ${bg} text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-[slideIn_0.3s_ease]`}>
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onDismiss} className="opacity-70 hover:opacity-100"><X size={14} /></button>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────

function VerticalSlider({ value, colorClass = 'bg-blue-500' }) {
  return (
    <div className="h-20 w-3 bg-gray-100 dark:bg-gray-800 rounded-full flex flex-col justify-end relative border border-gray-100 dark:border-gray-700">
      <div className={`w-4 h-4 ${colorClass} rounded-full absolute border-[3px] border-white dark:border-gray-900 shadow-sm transition-all duration-700`}
        style={{ bottom: `${Math.min(100, Math.max(0, value))}%`, transform: 'translateY(50%)' }} />
    </div>
  );
}

function HighlightCard({ title, children, delay = 0 }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-[24px] p-6 shadow-sm dark:shadow-none border border-gray-100 dark:border-gray-800 flex flex-col hover:shadow-md dark:hover:border-gray-700 transition-all min-h-[200px] animate-[fadeInUp_0.5s_ease-out_forwards] opacity-0"
      style={{ animationDelay: `${delay}ms` }}>
      <h3 className="text-gray-400 dark:text-gray-500 text-sm font-medium mb-4 flex-shrink-0">{title}</h3>
      <div className="flex-1 flex flex-col justify-center">{children}</div>
    </div>
  );
}

function UVGauge({ value, max = 12 }) {
  const radius = 40, cx = 50, cy = 45, sw = 10;
  const circ = Math.PI * radius;
  const pct = Math.min(1, (value || 0) / max);
  const strokeColor = value > 8 ? '#EF4444' : value > 5 ? '#FBBF24' : '#34D399';
  return (
    <div className="relative w-full mt-4">
      <svg viewBox="0 0 100 50" className="w-full h-auto max-w-[150px] mx-auto overflow-visible">
        <path d={`M ${cx - radius},${cy} A ${radius},${radius} 0 0,1 ${cx + radius},${cy}`}
          fill="none" stroke="currentColor" className="text-gray-100 dark:text-gray-800" strokeWidth={sw} strokeLinecap="round" />
        <path d={`M ${cx - radius},${cy} A ${radius},${radius} 0 0,1 ${cx + radius},${cy}`}
          fill="none" stroke={strokeColor} strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={`${pct * circ} ${circ}`} style={{ transition: 'stroke-dasharray 0.8s ease, stroke 0.8s' }} />
      </svg>
      <div className="text-center -mt-1"><span className="text-3xl font-semibold text-gray-800 dark:text-white">{value ?? '--'}</span></div>
      <div className="flex justify-between text-xs text-gray-400 dark:text-gray-600 mt-1 px-2"><span>0</span><span>6</span><span>12</span></div>
    </div>
  );
}

function WeatherGraphic({ icon, loading }) {
  const cond = (icon || '').toLowerCase();
  const isClear = cond.includes('clear') || cond.includes('sun');
  const isCloudy = cond.includes('cloud') || cond.includes('overcast');
  const isRain = cond.includes('rain') || cond.includes('drizzle') || cond.includes('shower');
  const isSnow = cond.includes('snow') || cond.includes('ice') || cond.includes('sleet');
  const isStorm = cond.includes('storm') || cond.includes('thunder');
  const isNight = cond.includes('night');

  if (loading) {
    return (
      <div className="relative w-56 h-48 mx-auto my-6">
        <div className="absolute inset-8 rounded-full bg-gray-200 dark:bg-gray-800 animate-pulse" />
      </div>
    );
  }

  const sunGrad = isNight ? 'from-gray-400 to-gray-500' : 'from-[#FFD54F] to-[#FBC02D]';

  return (
    <div className="relative w-56 h-48 mx-auto my-6">
      {/* Cloud outline */}
      {!isClear && (
        <svg className={`absolute top-0 left-8 w-40 h-40 transition-all duration-700 ${isStorm ? 'text-gray-400 dark:text-gray-500' : 'text-gray-200 dark:text-gray-700'} opacity-70`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.5 19a5.5 5.5 0 0 0-4-9.35A8 8 0 0 0 2.45 14 5.5 5.5 0 0 0 8 19h9.5z" />
        </svg>
      )}

      {/* Sun */}
      <div className={`absolute top-8 left-[28px] w-[100px] h-[100px] bg-gradient-to-b ${sunGrad} rounded-full shadow-lg transition-all duration-1000
        ${isCloudy || isRain || isSnow ? 'opacity-70 scale-90' : ''}
        ${isStorm ? 'opacity-40 scale-75' : ''}`} />

      {/* Rain bars */}
      {isRain && (
        <div className="absolute bottom-6 right-16 flex gap-2">
          <div className="w-[6px] h-14 bg-gradient-to-b from-blue-400 to-blue-600 rounded-full animate-[rainDrop1_1s_ease-in-out_infinite]" />
          <div className="w-[6px] h-20 bg-gradient-to-b from-blue-400 to-blue-600 rounded-full -mt-4 animate-[rainDrop2_1.3s_ease-in-out_0.15s_infinite]" />
          <div className="w-[6px] h-16 bg-gradient-to-b from-blue-400 to-blue-600 rounded-full mt-2 animate-[rainDrop3_0.9s_ease-in-out_0.3s_infinite]" />
        </div>
      )}

      {/* Snow dots */}
      {isSnow && (
        <div className="absolute bottom-4 right-14 flex gap-2">
          {[0, 0.3, 0.6, 0.15].map((d, i) => (
            <div key={i} className="w-3 h-3 bg-white dark:bg-gray-300 border border-blue-200 rounded-full animate-[snowFloat_2s_ease-in-out_infinite]" style={{ animationDelay: `${d}s` }} />
          ))}
        </div>
      )}

      {/* Lightning */}
      {isStorm && (
        <svg className="absolute bottom-2 right-[58px] w-10 h-10 text-yellow-400 animate-[lightning_3s_ease-in-out_infinite] drop-shadow-[0_0_6px_rgba(250,204,21,0.5)]" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14 2L4 14h7l-2 8 10-12h-7l2-8z" />
        </svg>
      )}
    </div>
  );
}

// ─── City Image ─────────────────────────────────────────────────

const imageCache = new Map();

function CityImage({ cityName }) {
  const [imgUrl, setImgUrl] = useState(null);
  const [imgState, setImgState] = useState('loading');
  const abortRef = useRef(null);

  useEffect(() => {
    if (!cityName) return;
    const name = cityName.split(',')[0]?.trim() || cityName;
    if (!name) return;

    if (imageCache.has(name)) { setImgUrl(imageCache.get(name)); setImgState('loaded'); return; }

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setImgUrl(null);
    setImgState('loading');

    const queries = [name, name + ' City', name + ' (city)', cityName.split(',').slice(0, 2).join(', ')].filter(Boolean);

    (async () => {
      for (const q of queries) {
        if (controller.signal.aborted) return;
        try {
          const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`, { signal: controller.signal });
          if (r.ok) { const p = await r.json(); if (p.thumbnail?.source) { imageCache.set(name, p.thumbnail.source); if (!controller.signal.aborted) { setImgUrl(p.thumbnail.source); setImgState('loaded'); } return; } }
        } catch (e) { if (e.name === 'AbortError') return; }
      }
      // MediaWiki fallback
      if (!controller.signal.aborted) {
        try {
          const wr = await fetch(`https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&titles=${encodeURIComponent(name)}&pithumbsize=600&format=json&origin=*`, { signal: controller.signal });
          if (wr.ok) { const wd = await wr.json(); const fp = Object.values(wd.query?.pages || {})[0]; if (fp?.thumbnail?.source) { imageCache.set(name, fp.thumbnail.source); if (!controller.signal.aborted) { setImgUrl(fp.thumbnail.source); setImgState('loaded'); } return; } }
        } catch (e) { if (e.name === 'AbortError') return; }
      }
      if (!controller.signal.aborted) setImgState('fallback');
    })();

    return () => controller.abort();
  }, [cityName]);

  const display = cityName?.split(',')[0] || cityName;
  return (
    <div className="mt-6 relative h-28 rounded-2xl overflow-hidden group">
      {imgState === 'loading' && <div className="absolute inset-0 bg-gray-200 dark:bg-gray-800 animate-pulse" />}
      {imgState === 'loaded' && imgUrl ? (
        <img src={imgUrl} alt={cityName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
      ) : imgState === 'fallback' ? (
        <div className="w-full h-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center">
          <span className="text-white/50 text-[10px] uppercase tracking-[0.3em] font-black">{display}</span>
        </div>
      ) : null}
      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
        <span className="text-white font-medium text-sm drop-shadow-md px-4 text-center leading-tight">{display}</span>
      </div>
    </div>
  );
}

// ─── Live Clock ─────────────────────────────────────────────────

function useClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setTime(new Date()), 60000); return () => clearInterval(id); }, []);
  return time;
}

// ─── Skeletons ──────────────────────────────────────────────────

function SidebarSkeleton() {
  return (
    <div className="w-full md:w-[320px] bg-white dark:bg-gray-950 p-8 flex flex-col shrink-0 animate-pulse">
      <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-full mb-8" />
      <div className="w-48 h-48 bg-gray-100 dark:bg-gray-800 rounded-full mx-auto my-4" />
      <div className="h-16 w-32 bg-gray-100 dark:bg-gray-800 rounded-xl mx-auto mb-2" />
      <div className="h-4 w-40 bg-gray-100 dark:bg-gray-800 rounded mx-auto mb-4" />
      <hr className="border-gray-100 dark:border-gray-800 my-6" />
      <div className="h-4 w-32 bg-gray-100 dark:bg-gray-800 rounded mb-3" />
      <div className="h-4 w-24 bg-gray-100 dark:bg-gray-800 rounded mb-8" />
      <div className="flex-grow" />
      <div className="h-28 bg-gray-100 dark:bg-gray-800 rounded-2xl" />
    </div>
  );
}

function MainContentSkeleton() {
  return (
    <div className="flex-1 bg-white dark:bg-gray-950 p-8 md:p-12 flex flex-col animate-pulse">
      <div className="flex justify-between mb-10">
        <div className="flex gap-6"><div className="h-6 w-16 bg-gray-200 dark:bg-gray-800 rounded" /><div className="h-6 w-16 bg-gray-200 dark:bg-gray-800 rounded" /></div>
        <div className="flex gap-3"><div className="h-9 w-20 bg-gray-200 dark:bg-gray-800 rounded-full" /></div>
      </div>
      <div className="flex gap-4 mb-8 overflow-hidden">
        {[...Array(7)].map((_, i) => <div key={i} className="bg-gray-200 dark:bg-gray-800 rounded-2xl p-4 min-w-[80px] h-32 flex-shrink-0" />)}
      </div>
      <div className="h-6 w-48 bg-gray-200 dark:bg-gray-800 rounded mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => <div key={i} className="bg-gray-200 dark:bg-gray-800 rounded-[24px] h-40" />)}
      </div>
    </div>
  );
}

// ─── Sidebar ────────────────────────────────────────────────────

function Sidebar({
  data, unit, loading, search, getCurrentLocation, geolocating,
  savedLocations, isSaved, toggleSaved, removeSavedLocation, showToast, lastUpdated, darkMode,
}) {
  const searchRef = useRef(null);
  const [query, setQuery] = useState('');
  const clock = useClock();
  const tempUnit = unit === 'metric' ? '°C' : '°F';
  const current = data?.currentConditions || {};
  const today = data?.days?.[0] || {};
  const locName = data?.resolvedAddress || '';
  const dateStr = clock.toLocaleDateString('en-US', { weekday: 'long' });
  const timeStr = clock.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const pinned = isSaved();

  useEffect(() => {
    const h = (e) => { if (e.key === '/' && document.activeElement !== searchRef.current) { e.preventDefault(); searchRef.current?.focus(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  return (
    <div className="w-full md:w-[320px] bg-white dark:bg-gray-950 p-8 flex flex-col shrink-0 border-r border-gray-100 dark:border-gray-800/50">
      <form onSubmit={(e) => { e.preventDefault(); if (query.trim()) search(query.trim()); }} className="flex items-center gap-3 text-gray-800 dark:text-gray-200 mb-6 mt-2">
        {loading ? <Loader2 size={20} className="text-blue-500 animate-spin flex-shrink-0" /> : <Search size={20} className="text-gray-400 flex-shrink-0" />}
        <input ref={searchRef} type="text" value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search for places ..."
          className="bg-transparent outline-none text-sm w-full placeholder-gray-400 dark:placeholder-gray-500 font-medium text-gray-800 dark:text-white" />
        {query && <button type="button" onClick={() => { setQuery(''); searchRef.current?.focus(); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"><X size={16} /></button>}
        <span className="hidden sm:inline-block border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5 text-[10px] font-mono text-gray-400 bg-gray-50/80 dark:bg-gray-800/80">/</span>
        <button type="button" onClick={getCurrentLocation} disabled={geolocating} className={`bg-gray-100 dark:bg-gray-800 p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex-shrink-0 ${geolocating ? 'animate-pulse' : 'cursor-pointer'}`} title="Get current location">
          {geolocating ? <Loader2 size={16} className="text-blue-500 animate-spin" /> : <MapPin size={16} className="text-gray-600 dark:text-gray-400" />}
        </button>
      </form>

      {savedLocations.length > 0 && (
        <div className="mb-6">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2 px-1">Saved Locations</h3>
          <div className="flex flex-wrap gap-1.5">
            {savedLocations.map(loc => (
              <button key={loc} onClick={() => { search(loc); setQuery(''); }}
                className="group inline-flex items-center gap-1 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium px-2.5 py-1 rounded-full transition-colors">
                <span>{loc}</span>
                <span onClick={(e) => { e.stopPropagation(); removeSavedLocation(loc); }} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"><X size={12} /></span>
              </button>
            ))}
          </div>
        </div>
      )}

      <WeatherGraphic icon={data?.currentConditions?.icon} loading={loading && !data} />

      <div className="text-center mt-2 mb-6">
        <h1 className="text-7xl font-light text-gray-900 dark:text-white leading-none">
          <AnimatedCounter value={current.temp != null ? Math.round(current.temp) : null} />
          <span className="text-5xl align-top">{tempUnit}</span>
        </h1>
        <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
          Feels like <AnimatedCounter value={current.feelslike != null ? Math.round(current.feelslike) : null} />{tempUnit}
        </p>
        <p className="text-gray-800 dark:text-gray-200 mt-4 text-base">{dateStr}, <span className="text-gray-400 dark:text-gray-500">{timeStr}</span></p>
      </div>

      <hr className="border-gray-200 dark:border-gray-800 my-4" />

      <div className="flex flex-col gap-4 text-gray-600 dark:text-gray-300 font-medium text-sm">
        <div className="flex items-center gap-4">
          <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.5 19a5.5 5.5 0 0 0-4-9.35A8 8 0 0 0 2.45 14 5.5 5.5 0 0 0 8 19h9.5z" />
          </svg>
          <span>{current.conditions || '--'}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-0.5 h-4 items-end">
            <div className="w-[3px] h-3 bg-[#2962FF] rounded-full" /><div className="w-[3px] h-4 bg-[#2962FF] rounded-full" /><div className="w-[3px] h-2 bg-[#2962FF] rounded-full" />
          </div>
          <span>Rain - <AnimatedCounter value={Math.round(today.precipprob || 0)} suffix="%" /></span>
        </div>
      </div>

      {lastUpdated && (
        <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-4 text-center">Updated {fmtLastUpdated(lastUpdated)}</p>
      )}

      <div className="flex-grow" />

      <div className="mt-6 relative">
        <CityImage cityName={locName} />
        <button onClick={toggleSaved}
          className={`absolute top-2 right-2 p-1.5 rounded-full transition-colors ${pinned ? 'bg-yellow-400 text-white' : 'bg-white/80 dark:bg-gray-900/80 text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-900'}`}
          title={pinned ? 'Unpin location' : 'Pin location'}>
          {pinned ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
        </button>
      </div>
    </div>
  );
}

// ─── Main Content ───────────────────────────────────────────────

function MainContent({ data, unit, toggleUnit, loading, refresh, darkMode, toggleDarkMode }) {
  const [view, setView] = useState('week');
  const tempUnit = unit === 'metric' ? '°C' : '°F';
  const speedUnit = unit === 'metric' ? 'km/h' : 'mph';
  const distUnit = unit === 'metric' ? 'km' : 'mi';
  const today = data?.days?.[0] || {};
  const current = data?.currentConditions || {};
  const days = data?.days || [];
  const aqiInfo = aqiLabel(data?.aqi);
  const tint = data?.currentConditions?.icon ? getWeatherTint(data.currentConditions.icon) : '';

  const weekData = useMemo(() => {
    const total = data?.isLimited ? Math.min(3, days.length) : Math.min(7, days.length);
    return days.slice(0, total).map(d => ({ day: fmtDate(d.datetime), max: `${Math.round(d.tempmax)}°`, min: `${Math.round(d.tempmin)}°`, icon: d.icon || '' }));
  }, [days, data?.isLimited]);

  const WeatherDot = ({ icon, small }) => {
    const size = small ? 'w-5 h-5' : 'w-8 h-8';
    const c = (icon || '').toLowerCase();
    if (c.includes('sun') || c.includes('clear')) return <div className={`${size} bg-yellow-400 rounded-full`} />;
    if (c.includes('snow') || c.includes('ice')) return <div className={`${size} bg-blue-200 rounded-full flex items-center justify-center`}><span className={`${small ? 'text-[8px]' : 'text-xs'} text-white`}>*</span></div>;
    if (c.includes('rain') || c.includes('shower') || c.includes('drizzle')) return <svg className={`${size} text-blue-300 fill-current`} viewBox="0 0 24 24"><path d="M17.5 19a5.5 5.5 0 0 0-4-9.35A8 8 0 0 0 2.45 14 5.5 5.5 0 0 0 8 19h9.5z" /></svg>;
    if (c.includes('cloud') || c.includes('overcast')) return <svg className={`${size} text-gray-300 dark:text-gray-600 fill-current`} viewBox="0 0 24 24"><path d="M17.5 19a5.5 5.5 0 0 0-4-9.35A8 8 0 0 0 2.45 14 5.5 5.5 0 0 0 8 19h9.5z" /></svg>;
    return <div className={`${size} bg-yellow-400 rounded-full`} />;
  };

  return (
    <div className={`flex-1 bg-white dark:bg-gray-950 p-8 md:p-12 flex flex-col relative transition-colors duration-700 ${tint}`}>
      {loading && data && (
        <div className="absolute inset-0 bg-white/60 dark:bg-gray-950/60 z-10 flex items-center justify-center">
          <Loader2 size={32} className="text-blue-500 animate-spin" />
        </div>
      )}

      <div className="flex justify-between items-center mb-10">
        <div className="flex gap-6 text-xl font-medium">
          <button onClick={() => setView('today')}
            className={`transition-colors pb-1 ${view === 'today' ? 'text-gray-900 dark:text-white border-b-2 border-gray-900 dark:border-white' : 'text-gray-400 dark:text-gray-600 hover:text-gray-900 dark:hover:text-gray-300'}`}>Today</button>
          <button onClick={() => setView('week')}
            className={`transition-colors pb-1 ${view === 'week' ? 'text-gray-900 dark:text-white border-b-2 border-gray-900 dark:border-white' : 'text-gray-400 dark:text-gray-600 hover:text-gray-900 dark:hover:text-gray-300'}`}>Week</button>
        </div>
        <div className="flex gap-3 items-center">
          <button onClick={refresh} className="w-9 h-9 rounded-full bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 shadow-sm border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition flex items-center justify-center" title="Refresh weather">
            <RefreshCw size={15} />
          </button>
          <button onClick={toggleDarkMode} className="w-9 h-9 rounded-full bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 shadow-sm border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition flex items-center justify-center" title="Toggle theme">
            {darkMode ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-full p-1 shadow-sm gap-1">
            <button onClick={() => unit !== 'metric' && toggleUnit()}
              className={`w-8 h-8 rounded-full font-medium flex items-center justify-center text-sm transition-all ${unit === 'metric' ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-transparent text-gray-400 dark:text-gray-500'}`}>°C</button>
            <button onClick={() => unit !== 'us' && toggleUnit()}
              className={`w-8 h-8 rounded-full font-medium flex items-center justify-center text-sm transition-all ${unit === 'us' ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-transparent text-gray-400 dark:text-gray-500'}`}>°F</button>
          </div>
        </div>
      </div>

      {view === 'week' ? (
        <div className="flex gap-4 mb-8 overflow-x-auto pb-4 no-scrollbar">
          {weekData.map((day, idx) => (
            <div key={idx} className="bg-white dark:bg-gray-900 rounded-2xl p-4 flex flex-col items-center min-w-[80px] shadow-sm dark:shadow-none border border-gray-100 dark:border-gray-800 flex-shrink-0 hover:shadow-md dark:hover:border-gray-700 transition-all">
              <span className="text-sm font-medium text-gray-800 dark:text-gray-300 mb-3">{day.day}</span>
              <div className="h-10 w-10 flex items-center justify-center mb-3"><WeatherDot icon={day.icon} /></div>
              <div className="flex gap-2 text-sm font-medium"><span className="text-gray-900 dark:text-white">{day.max}</span><span className="text-gray-400 dark:text-gray-600">{day.min}</span></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-4 mb-8 overflow-x-auto pb-4 no-scrollbar">
          {today.hours?.filter(h => parseInt(h.datetime.substring(0, 2)) >= new Date().getHours()).map((h, idx) => (
            <div key={idx} className="bg-white dark:bg-gray-900 rounded-2xl p-4 flex flex-col items-center min-w-[80px] shadow-sm dark:shadow-none border border-gray-100 dark:border-gray-800 flex-shrink-0 hover:shadow-md dark:hover:border-gray-700 transition-all">
              <span className="text-sm font-medium text-gray-800 dark:text-gray-300 mb-3">{idx === 0 ? 'Now' : fmtTime(h.datetime)}</span>
              <div className="h-10 w-10 flex items-center justify-center mb-3"><WeatherDot icon={h.icon} /></div>
              <span className="text-sm font-medium text-gray-900 dark:text-white"><AnimatedCounter value={Math.round(h.temp)} suffix="°" /></span>
            </div>
          ))}
        </div>
      )}

      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Today's Highlights</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <HighlightCard title="UV Index" delay={0}>
          <div className="flex-1 flex items-center justify-center"><UVGauge value={current.uvindex} /></div>
        </HighlightCard>

        <HighlightCard title="Wind Status" delay={80}>
          <div className="flex flex-col flex-1">
            <h4 className="text-5xl font-light text-gray-900 dark:text-white flex items-baseline gap-1 mt-2">
              <AnimatedCounter value={current.windspeed != null ? parseFloat(current.windspeed.toFixed(1)) : null} />
              <span className="text-xl font-medium text-gray-400 dark:text-gray-500">{speedUnit}</span>
            </h4>
            <div className="mt-auto flex items-center gap-3 pt-4">
              <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center border border-blue-100 dark:border-blue-500/20"
                style={{ transform: `rotate(${current.winddir || 0}deg)` }} title={`${getWindDir(current.winddir)} at ${current.windspeed} ${speedUnit}`}>
                <Navigation size={16} className="text-blue-600 dark:text-blue-400" fill="currentColor" />
              </div>
              <span className="text-sm font-medium text-gray-800 dark:text-gray-300">{getWindDir(current.winddir)}</span>
            </div>
          </div>
        </HighlightCard>

        <HighlightCard title="Sunrise & Sunset" delay={160}>
          <div className="flex flex-col gap-6 mt-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 flex items-center justify-center">
                <ChevronUp size={20} className="text-yellow-500" strokeWidth={3} />
              </div>
              <div><p className="text-gray-800 dark:text-white font-medium text-lg">{fmtTime(today.sunrise)}</p><p className="text-gray-400 dark:text-gray-500 text-xs">Sunrise</p></div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 flex items-center justify-center">
                <ChevronDown size={20} className="text-orange-500" strokeWidth={3} />
              </div>
              <div><p className="text-gray-800 dark:text-white font-medium text-lg">{fmtTime(today.sunset)}</p><p className="text-gray-400 dark:text-gray-500 text-xs">Sunset</p></div>
            </div>
          </div>
        </HighlightCard>

        <HighlightCard title="Humidity" delay={240}>
          <div className="flex justify-between items-start flex-1">
            <div className="flex flex-col justify-between flex-1">
              <h4 className="text-4xl font-light text-gray-900 dark:text-white mt-2"><AnimatedCounter value={current.humidity} suffix="%" /></h4>
              <p className="text-gray-800 dark:text-gray-300 font-medium text-sm flex items-center gap-2 mt-auto">
                {current.humidity < 30 ? 'Dry' : current.humidity > 70 ? 'Humid' : 'Normal'}
                <span>{current.humidity < 30 ? '🌵' : current.humidity > 70 ? '🥵' : '🤙'}</span>
              </p>
            </div>
            <VerticalSlider value={current.humidity || 0} colorClass="bg-blue-500" />
          </div>
        </HighlightCard>

        <HighlightCard title="Visibility" delay={320}>
          <div className="flex flex-col justify-between flex-1">
            <h4 className="text-4xl font-light text-gray-900 dark:text-white mt-2"><AnimatedCounter value={current.visibility} /> <span className="text-2xl font-medium text-gray-400 dark:text-gray-500">{distUnit}</span></h4>
            <p className="text-gray-800 dark:text-gray-300 font-medium text-sm flex items-center gap-2 mt-auto">
              {current.visibility >= 10 ? 'Clear' : 'Average'} <span>{current.visibility >= 10 ? '😎' : '🙁'}</span>
            </p>
          </div>
        </HighlightCard>

        <HighlightCard title="Air Quality" delay={400}>
          <div className="flex justify-between items-start flex-1">
            <div className="flex flex-col justify-between flex-1">
              <h4 className="text-4xl font-light text-gray-900 dark:text-white mt-2"><AnimatedCounter value={data?.aqi} /></h4>
              <p className="text-gray-800 dark:text-gray-300 font-medium text-sm flex items-center gap-2 mt-auto">{aqiInfo.label} <span>{aqiInfo.emoji}</span></p>
            </div>
            <VerticalSlider value={aqiInfo.bar} colorClass={aqiInfo.color} />
          </div>
        </HighlightCard>
      </div>
    </div>
  );
}

// ─── Weather Particles ─────────────────────────────────────────

function WeatherParticles({ icon }) {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const rafRef = useRef(null);
  const rayAngleRef = useRef(0);

  useEffect(() => {
    const cond = (icon || '').toLowerCase();
    let type = 'clear';
    if (cond.includes('rain') || cond.includes('drizzle')) type = 'rain';
    else if (cond.includes('storm') || cond.includes('thunder')) type = 'storm';
    else if (cond.includes('snow') || cond.includes('sleet') || cond.includes('ice') || cond.includes('flurry')) type = 'snow';
    else if (cond.includes('cloud') || cond.includes('overcast') || cond.includes('fog')) type = 'cloudy';

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    const dims = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth, h = window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { w, h };
    };

    const build = (w, h) => {
      const p = [];
      const n = type === 'rain' || type === 'storm' ? 80 : type === 'snow' ? 60 : type === 'cloudy' ? 5 : 0;
      for (let i = 0; i < n; i++) {
        if (type === 'rain' || type === 'storm')
          p.push({ x: Math.random() * w, y: Math.random() * -h, vy: 8 + Math.random() * 12, vx: Math.random() - 0.5, len: 15 + Math.random() * 15, op: 0.1 + Math.random() * 0.3 });
        else if (type === 'snow')
          p.push({ x: Math.random() * w, y: Math.random() * -h, vy: 0.6 + Math.random() * 1, vx: Math.random() - 0.5, r: 1 + Math.random() * 2.5, op: 0.15 + Math.random() * 0.4, sa: Math.random() * 0.02, aa: Math.random() * Math.PI * 2 });
        else if (type === 'cloudy')
          p.push({ x: Math.random() * (w + 400) - 200, y: Math.random() * h * 0.4, r: 70 + Math.random() * 80, vx: 0.03 + Math.random() * 0.15, op: 0.01 + Math.random() * 0.04 });
      }
      particlesRef.current = p;
    };

    const tick = () => {
      const { w, h } = dims();
      ctx.clearRect(0, 0, w, h);
      if (type === 'clear' && !document.documentElement.classList.contains('dark')) {
        ctx.save();
        ctx.translate(w * 0.85, h * 0.15);
        rayAngleRef.current += 0.0005;
        ctx.rotate(rayAngleRef.current);
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI * 2) / 8;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, Math.max(w, h) * 0.8, a - 0.15, a + 0.15); ctx.closePath();
          const g = ctx.createRadialGradient(0, 0, 50, 0, 0, Math.max(w, h) * 0.8);
          g.addColorStop(0, 'rgba(251,191,36,0.05)'); g.addColorStop(1, 'rgba(251,191,36,0)');
          ctx.fillStyle = g; ctx.fill();
        }
        ctx.restore();
      } else {
        particlesRef.current.forEach(p => {
          if (type === 'rain' || type === 'storm') {
            p.y += p.vy; p.x += p.vx; if (p.y > h) { p.y = Math.random() * -50; p.x = Math.random() * w; }
            ctx.beginPath(); ctx.strokeStyle = `rgba(156,163,175,${p.op})`; ctx.lineWidth = 1.2;
            ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.vx * 2, p.y + p.len); ctx.stroke();
          } else if (type === 'snow') {
            p.y += p.vy; p.aa += p.sa; p.x += p.vx + Math.sin(p.aa) * 0.3;
            if (p.y > h || p.x < 0 || p.x > w) { p.y = Math.random() * -20; p.x = Math.random() * w; }
            ctx.beginPath(); ctx.fillStyle = `rgba(255,255,255,${p.op})`; ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
          } else if (type === 'cloudy') {
            p.x += p.vx; if (p.x - p.r > w) { p.x = -p.r; p.y = Math.random() * h * 0.4; }
            ctx.beginPath(); ctx.fillStyle = `rgba(255,255,255,${p.op})`; ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(p.x + p.r * 0.5, p.y + 10, p.r * 0.8, 0, Math.PI * 2); ctx.fill();
          }
        });
      }
      animId = requestAnimationFrame(tick);
    };

    const d = dims(); build(d.w, d.h); tick();
    return () => cancelAnimationFrame(animId);
  }, [icon]);

  return <canvas ref={canvasRef} className="fixed inset-0 z-0 pointer-events-none" />;
}

// ─── App Root ───────────────────────────────────────────────────

export default function App() {
  const {
    data, loading, error, unit, geolocating,
    savedLocations, toast, lastUpdated, darkMode,
    search, toggleUnit, getCurrentLocation, fetchWeather, refresh,
    addSavedLocation, removeSavedLocation, isSaved, toggleSaved,
    showToast, dismissToast, toggleDarkMode,
  } = useWeather();

  useEffect(() => {
    const last = savedLocations[0];
    if (last) fetchWeather(last);
    else fetchWeather('New York');
  }, []);

  return (
    <div className="min-h-screen flex flex-col md:flex-row font-sans transition-colors duration-300">
      <WeatherParticles icon={data?.currentConditions?.icon} />
      <Toast message={toast?.msg} type={toast?.type} onDismiss={dismissToast} />

      {loading && !data && !error ? (
        <><SidebarSkeleton /><MainContentSkeleton /></>
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center min-h-screen bg-white dark:bg-gray-950">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-500/10 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Could not load weather</h2>
          <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-6">{error}</p>
          <button onClick={() => fetchWeather('New York')} className="px-6 py-2 bg-gray-900 dark:bg-white dark:text-gray-900 text-white rounded-full font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition">Try Again</button>
        </div>
      ) : (
        <>
          <Sidebar
            data={data} unit={unit} loading={loading}
            search={search} getCurrentLocation={getCurrentLocation} geolocating={geolocating}
            savedLocations={savedLocations} isSaved={isSaved} toggleSaved={toggleSaved}
            removeSavedLocation={removeSavedLocation} showToast={showToast}
            lastUpdated={lastUpdated} darkMode={darkMode}
          />
          <MainContent
            data={data} unit={unit} toggleUnit={toggleUnit} loading={loading}
            refresh={refresh} darkMode={darkMode} toggleDarkMode={toggleDarkMode}
          />
        </>
      )}
    </div>
  );
}
