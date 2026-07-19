import { useState, useCallback, useEffect, useRef } from 'react';

const CACHE = new Map();
const CACHE_TTL = 10 * 60 * 1000;
const AUTO_REFRESH_MS = 15 * 60 * 1000;

function loadSaved() {
  try { return JSON.parse(localStorage.getItem('weather_saved_locations') || '[]'); } catch { return []; }
}
function saveSaved(list) {
  try { localStorage.setItem('weather_saved_locations', JSON.stringify(list)); } catch {}
}

function loadDarkMode() {
  try {
    const stored = localStorage.getItem('weather_dark_mode');
    const isDark = stored !== null ? stored === 'true' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', isDark);
    return isDark;
  } catch { return false; }
}

export function useWeather() {
  const [location, setLocation] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [unit, setUnit] = useState('metric');
  const [geolocating, setGeolocating] = useState(false);
  const [savedLocations, setSavedLocations] = useState(loadSaved);
  const [toast, setToast] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [darkMode, setDarkMode] = useState(loadDarkMode);
  const refreshTimerRef = useRef(null);

  const showToast = useCallback((msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  const toggleDarkMode = useCallback(() => {
    setDarkMode(prev => {
      const next = !prev;
      localStorage.setItem('weather_dark_mode', String(next));
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const fetchWeather = useCallback(async (loc, unitGroup = unit, silent = false) => {
    if (!loc || !loc.trim()) return;
    const locStr = loc.trim();

    if (!silent) setLoading(true);
    setError(null);
    setLocation(locStr);

    const cacheKey = `${locStr.toLowerCase()}-${unitGroup}`;
    const cached = CACHE.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setData(cached.data);
      setLastUpdated(new Date(cached.timestamp));
      if (!silent) setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/weather?location=${encodeURIComponent(locStr)}&unitGroup=${unitGroup}`, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to fetch weather data');
      }
      const json = await res.json();
      const now = Date.now();
      CACHE.set(cacheKey, { timestamp: now, data: json });
      setData(json);
      setLastUpdated(new Date(now));
      if (silent) showToast('Weather data refreshed', 'success');
    } catch (e) {
      setError(e.message);
      showToast(e.message, 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [unit, showToast]);

  // Auto-refresh every 15 minutes
  useEffect(() => {
    if (!location) return;
    refreshTimerRef.current = setInterval(() => {
      fetchWeather(location, unit, true);
    }, AUTO_REFRESH_MS);
    return () => clearInterval(refreshTimerRef.current);
  }, [location, unit, fetchWeather]);

  const refresh = useCallback(() => {
    if (location) fetchWeather(location, unit, true);
  }, [location, unit, fetchWeather]);

  const toggleUnit = useCallback(() => {
    const newUnit = unit === 'metric' ? 'us' : 'metric';
    setUnit(newUnit);
    if (location) fetchWeather(location, newUnit);
  }, [unit, location, fetchWeather]);

  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      showToast('Geolocation not supported', 'error');
      return;
    }
    setGeolocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { fetchWeather(`${pos.coords.latitude},${pos.coords.longitude}`); setGeolocating(false); },
      () => { showToast('Could not get your location', 'error'); setGeolocating(false); },
      { timeout: 5000, maximumAge: 300000 }
    );
  }, [fetchWeather, showToast]);

  const search = useCallback((loc) => {
    if (loc && loc.trim()) fetchWeather(loc.trim());
  }, [fetchWeather]);

  const addSavedLocation = useCallback((loc) => {
    setSavedLocations(prev => {
      if (prev.includes(loc)) return prev;
      const next = [loc, ...prev].slice(0, 10);
      saveSaved(next);
      showToast(`${loc} saved`, 'success');
      return next;
    });
  }, [showToast]);

  const removeSavedLocation = useCallback((loc) => {
    setSavedLocations(prev => { const next = prev.filter(l => l !== loc); saveSaved(next); return next; });
  }, []);

  const isSaved = useCallback(() => {
    if (!data) return false;
    return savedLocations.includes(data.resolvedAddress?.split(',')[0]?.trim());
  }, [savedLocations, data]);

  const toggleSaved = useCallback(() => {
    if (!data) return;
    const city = data.resolvedAddress?.split(',')[0]?.trim();
    if (!city) return;
    savedLocations.includes(city) ? removeSavedLocation(city) : addSavedLocation(city);
  }, [data, savedLocations, addSavedLocation, removeSavedLocation]);

  return {
    location, data, loading, error, unit, geolocating,
    savedLocations, toast, lastUpdated, darkMode,
    search, toggleUnit, getCurrentLocation, fetchWeather, refresh,
    addSavedLocation, removeSavedLocation, isSaved, toggleSaved,
    showToast, dismissToast, toggleDarkMode,
  };
}
