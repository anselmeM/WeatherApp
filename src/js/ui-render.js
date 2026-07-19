import { state, getDisplayTemp } from './state.js';
import { getWeatherIcon, getWindDirection, formatTime, showError } from '../utils.js';
import { drawTempChart } from '../chart.js';
import { showPaymentModal } from './auth.js';
import { initCanvasBackground, setWeatherEffect } from './canvas-bg.js';
import { showAlertBanner } from './components/alerts-ui.js';
import { updateHourlyForecast, updateWeeklyForecast } from './components/forecast-ui.js';
import { updateHighlights } from './components/highlights-ui.js';

// Caches for weather data of saved locations
const savedWeatherCache = new Map();

// Helper to get dynamic icon colors depending on condition type
export function getWeatherIconColor(iconName) {
  if (!iconName) return 'text-blue-500 dark:text-blue-400';
  const name = iconName.toLowerCase();
  if (name.includes('sun') || name.includes('clear') || name.includes('day')) {
    if (name.includes('cloud')) return 'text-amber-500/85 dark:text-amber-400/85';
    return 'text-amber-500 dark:text-amber-400';
  }
  if (name.includes('night') || name.includes('moon')) {
    return 'text-indigo-400 dark:text-indigo-300';
  }
  if (name.includes('cloud')) {
    return 'text-slate-400 dark:text-slate-500';
  }
  if (name.includes('rain') || name.includes('sleet') || name.includes('grain') || name.includes('drizzle')) {
    return 'text-blue-500 dark:text-blue-400';
  }
  if (name.includes('storm') || name.includes('thunder')) {
    return 'text-purple-600 dark:text-purple-400';
  }
  if (name.includes('snow') || name.includes('ice') || name.includes('flurry') || name.includes('ac_unit')) {
    return 'text-sky-300 dark:text-sky-200';
  }
  return 'text-blue-500 dark:text-blue-400';
}

// Fetch weather info for a saved location to show current temp
function getSavedLocationWeather(city) {
  if (savedWeatherCache.has(city)) {
    return savedWeatherCache.get(city);
  }

  if (savedWeatherCache.size >= 50) {
    const oldestKey = savedWeatherCache.keys().next().value;
    savedWeatherCache.delete(oldestKey);
  }

  const fetchPromise = (async () => {
    try {
      const response = await fetch(`/api/weather?city=${encodeURIComponent(city)}`);
      if (response.ok) {
        const data = await response.json();
        const current = data.currentConditions || data.days[0].hours[0];
        return {
          temp: current.temp,
          icon: current.icon
        };
      }
    } catch (e) {
      console.error(`Failed to fetch weather for saved city ${city}:`, e);
    }
    savedWeatherCache.delete(city); // Remove failed requests from cache
    return null;
  })();

  savedWeatherCache.set(city, fetchPromise);
  return fetchPromise;
}

// Helper to animate metric numbers counting up from 0
export function animateCounter(element, targetValue, suffix = "", duration = 800) {
  if (!element) return;
  const startValue = 0;
  const startTime = performance.now();
  
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Ease out quad
    const easeProgress = progress * (2 - progress);
    const currentValue = startValue + easeProgress * (targetValue - startValue);
    
    if (Number.isInteger(targetValue)) {
      element.textContent = Math.round(currentValue) + suffix;
    } else {
      element.textContent = currentValue.toFixed(1) + suffix;
    }
    
    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }
  
  requestAnimationFrame(update);
}

// Intl.DateTimeFormat caching
const currentDatetimeFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  hour: "2-digit",
  minute: "2-digit",
});
export const shortWeekdayFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short" });

// DOM elements cache
const loadingOverlay = document.getElementById("loading-overlay");
const weatherDashboard = document.getElementById("weather-dashboard");
const todayButton = document.getElementById("today-button");
const weekButton = document.getElementById("week-button");
const hourlySection = document.getElementById("hourly-forecast-section");
const weeklySection = document.getElementById("weekly-forecast-section");
const leftPanelContent = document.getElementById("left-panel-content");
const leftPanelSkeleton = document.getElementById("left-panel-skeleton");
const rightPanelContent = document.getElementById("right-panel-content");
const rightPanelSkeleton = document.getElementById("right-panel-skeleton");
const alertBanner = document.getElementById("weather-alert-banner");
const alertText = document.getElementById("weather-alert-text");
const mainWeatherIcon = document.getElementById("main-weather-icon");
const currentTempEl = document.getElementById("current-temp");
const feelsLikeTempEl = document.getElementById("feels-like-temp");
const currentDatetimeEl = document.getElementById("current-datetime");
const conditionIconEl = document.getElementById("condition-icon");
const conditionTextEl = document.getElementById("condition-text");
const rainChanceEl = document.getElementById("rain-chance");
const locationNameEl = document.getElementById("location-name");
const locationImage = document.getElementById("location-image");
const pinLocationBtn = document.getElementById("pin-location-btn");
const recentSearchesContainer = document.getElementById("recent-searches-container");
const recentSearchesList = document.getElementById("recent-searches-list");
const minutelyBars = document.getElementById("minutely-bars");
const minutelySummary = document.getElementById("minutely-summary");
const hourlyContainer = document.getElementById("hourly-forecast-container");
const forecastGrid = document.getElementById("forecast-grid");
const highlightsGrid = document.getElementById("highlights-grid");

// Image cache
const imageCache = new Map();
const MAX_IMAGE_CACHE_SIZE = 50;

// Callbacks
let onDeleteLocationCallback = null;
let onSelectLocationCallback = null;

export function setOnDeleteLocation(callback) {
  onDeleteLocationCallback = callback;
}

export function setOnSelectLocation(callback) {
  onSelectLocationCallback = callback;
}

let isCanvasInitialized = false;

export function showSkeleton() {
  leftPanelContent?.classList.add("hidden");
  rightPanelContent?.classList.add("hidden");
  leftPanelSkeleton?.classList.remove("hidden");
  rightPanelSkeleton?.classList.remove("hidden");
}

export function hideSkeleton() {
  leftPanelSkeleton?.classList.add("hidden");
  rightPanelSkeleton?.classList.add("hidden");
  
  if (!isCanvasInitialized) {
    initCanvasBackground();
    isCanvasInitialized = true;
  }
  
  // Show dashboard card and footer
  const dashboardFooter = document.getElementById("dashboard-footer");
  if (dashboardFooter) dashboardFooter.classList.remove("hidden");
  
  leftPanelContent?.classList.remove("hidden");
  rightPanelContent?.classList.remove("hidden");
  
  leftPanelContent?.classList.add("fade-out-transition");
  rightPanelContent?.classList.add("fade-out-transition");
  
  void leftPanelContent?.offsetWidth; // Trigger reflow
  
  leftPanelContent?.classList.remove("fade-out-transition");
  rightPanelContent?.classList.remove("fade-out-transition");
}

export function toggleForecastView(view) {
  if (view === "today") {
    hourlySection?.classList.remove("view-hidden");
    weeklySection?.classList.add("view-hidden");
    if (todayButton) {
      todayButton.className = "text-gray-900 dark:text-white font-bold text-base sm:text-lg border-b-4 border-blue-500 pb-1 interactive-element";
      todayButton.setAttribute('aria-selected', 'true');
    }
    if (weekButton) {
      weekButton.className = "text-gray-500 dark:text-gray-400 font-bold text-base sm:text-lg interactive-element hover:text-gray-700 dark:hover:text-gray-200";
      weekButton.setAttribute('aria-selected', 'false');
    }
  } else {
    hourlySection?.classList.add("view-hidden");
    weeklySection?.classList.remove("view-hidden");
    if (weekButton) {
      weekButton.className = "text-gray-900 dark:text-white font-bold text-base sm:text-lg border-b-4 border-blue-500 pb-1 interactive-element";
      weekButton.setAttribute('aria-selected', 'true');
    }
    if (todayButton) {
      todayButton.className = "text-gray-500 dark:text-gray-400 font-bold text-base sm:text-lg interactive-element hover:text-gray-700 dark:hover:text-gray-200";
      todayButton.setAttribute('aria-selected', 'false');
    }
  }
}

export function updateBackground(condition) {
  const body = document.body;
  body.classList.remove(
    "weather-bg-clear",
    "weather-bg-cloudy",
    "weather-bg-rain",
    "weather-bg-snow",
    "weather-bg-storm",
  );

  if (condition.includes("rain")) body.classList.add("weather-bg-rain");
  else if (condition.includes("snow")) body.classList.add("weather-bg-snow");
  else if (condition.includes("cloud")) body.classList.add("weather-bg-cloudy");
  else if (condition.includes("storm")) body.classList.add("weather-bg-storm");
  else body.classList.add("weather-bg-clear");
  
  // Update canvas particle effect
  setWeatherEffect(condition);
}

export function updateRecentSearchesUI() {
  if (!recentSearchesContainer || !recentSearchesList) return;

  if (state.recentSearches.length === 0) {
    recentSearchesContainer.classList.remove("hidden");
    recentSearchesList.innerHTML = '<p class="text-xs text-gray-400 px-2">Search for a city to get weather</p>';
    return;
  }
  
  recentSearchesContainer.classList.remove("hidden");
  recentSearchesList.innerHTML = "";
  const fragment = document.createDocumentFragment();
  
  state.recentSearches.forEach((city) => {
    const container = document.createElement("div");
    container.className = "inline-flex items-center bg-white/30 dark:bg-gray-700/50 text-gray-800 dark:text-white text-xs font-bold pl-3 pr-2 py-1 rounded-full transition-all interactive-element";
    
    const label = document.createElement("span");
    label.className = "cursor-pointer";
    label.textContent = city;
    label.onclick = () => {
      if (onSelectLocationCallback) onSelectLocationCallback(city);
    };
    container.appendChild(label);
    
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "ml-1.5 hover:text-red-500 font-bold text-sm focus-visible:outline-none flex items-center justify-center w-4 h-4 rounded-full hover:bg-white/20";
    deleteBtn.innerHTML = "&times;";
    deleteBtn.title = `Remove ${city}`;
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      if (onDeleteLocationCallback) onDeleteLocationCallback(city);
    };
    
    // Asynchronously retrieve and append small weather indicators
    getSavedLocationWeather(city).then(w => {
      if (w && container.parentNode) {
        const tempUnit = state.unitGroup === "metric" ? "°C" : "°F";
        const tempVal = getDisplayTemp(w.temp);
        
        const infoSpan = document.createElement("span");
        infoSpan.className = "flex items-center ml-2 text-[10px] text-blue-600 dark:text-blue-400 font-bold bg-white/40 dark:bg-gray-800/40 px-1.5 py-0.5 rounded-md";
        infoSpan.innerHTML = `
          <span class="material-icons text-xs mr-0.5 ${getWeatherIconColor(w.icon)}">${getWeatherIcon(w.icon)}</span>
          <span>${tempVal}${tempUnit}</span>
        `;
        container.insertBefore(infoSpan, deleteBtn);
      }
    });

    container.appendChild(deleteBtn);
    
    fragment.appendChild(container);
  });
  recentSearchesList.appendChild(fragment);
}

export function updatePinButtonUI() {
  if (!pinLocationBtn || !state.currentWeatherData) return;
  const resolvedCity = state.currentWeatherData.resolvedAddress.split(",")[0].trim();
  const isPinned = state.recentSearches.some(c => c.toLowerCase() === resolvedCity.toLowerCase());
  const icon = pinLocationBtn.querySelector('.material-icons');
  if (icon) {
    if (isPinned) {
      icon.textContent = 'bookmark';
      pinLocationBtn.title = 'Unpin Location';
      pinLocationBtn.setAttribute('aria-label', 'Unpin Location');
    } else {
      icon.textContent = 'bookmark_border';
      pinLocationBtn.title = 'Pin Location';
      pinLocationBtn.setAttribute('aria-label', 'Pin Location');
    }
  }
}

export function showUpgradePrompt(feature) {
  const prompt = document.createElement('div');
  prompt.className = 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4';
  
  const template = document.getElementById('upgrade-prompt-template');
  if (template) {
    const clone = template.content.cloneNode(true);
    clone.querySelector('.feature-text').textContent = `${feature} requires a premium subscription.`;
    clone.querySelector('.upgrade-cancel')?.addEventListener('click', () => prompt.remove());
    clone.querySelector('.upgrade-btn')?.addEventListener('click', () => {
      prompt.remove();
      showPaymentModal();
    });
    prompt.appendChild(clone);
  }
  document.body.appendChild(prompt);
}

export function showRegisterPrompt(feature) {
  const prompt = document.createElement('div');
  prompt.className = 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4';
  
  const template = document.getElementById('register-prompt-template');
  if (template) {
    const clone = template.content.cloneNode(true);
    clone.querySelector('.feature-text').textContent = `${feature} requires a free account. Register now to save locations and sync them across devices!`;
    clone.querySelector('.register-cancel')?.addEventListener('click', () => prompt.remove());
    clone.querySelector('.register-btn')?.addEventListener('click', () => {
      prompt.remove();
      window.location.href = '/landing.html';
    });
    prompt.appendChild(clone);
  }
  document.body.appendChild(prompt);
}

const FAMOUS_LOCATION_IMAGES = {
  'new york': 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=600&q=80',
  'new york city': 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=600&q=80',
  'nyc': 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=600&q=80',
  'london': 'https://images.unsplash.com/photo-1513635269975-59663e0ca1ad?auto=format&fit=crop&w=600&q=80',
  'paris': 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=600&q=80',
  'tokyo': 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=600&q=80',
  'toronto': 'https://images.unsplash.com/photo-1507992781348-31024bc79483?auto=format&fit=crop&w=600&q=80',
  'sydney': 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?auto=format&fit=crop&w=600&q=80',
  'rome': 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=600&q=80',
  'san francisco': 'https://images.unsplash.com/photo-1506012787146-f92b2d7d6d96?auto=format&fit=crop&w=600&q=80',
  'seattle': 'https://images.unsplash.com/photo-1508859439226-60d1d1130e8a?auto=format&fit=crop&w=600&q=80',
  'miami': 'https://images.unsplash.com/photo-1514218953589-2d7d37efd2ec?auto=format&fit=crop&w=600&q=80',
};

function getCityImage(cityName) {
  const cleanName = cityName.trim().toLowerCase();
  if (FAMOUS_LOCATION_IMAGES[cleanName]) {
    return Promise.resolve(FAMOUS_LOCATION_IMAGES[cleanName]);
  }

  if (imageCache.has(cityName)) {
    const cachedPromise = imageCache.get(cityName);
    imageCache.delete(cityName);
    imageCache.set(cityName, cachedPromise);
    return cachedPromise;
  }

  const fetchPromise = (async () => {
    let imageUrl;
    try {
      const response = await fetch(`https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&titles=${encodeURIComponent(cityName)}&pithumbsize=600&format=json&origin=*`);
      const data = await response.json();
      const pages = data.query.pages;
      const pageId = Object.keys(pages)[0];
      if (pageId !== "-1" && pages[pageId].thumbnail) {
        imageUrl = pages[pageId].thumbnail.source;
      }
    } catch (e) {
      console.error("Failed to fetch city image:", e);
    }

    if (!imageUrl) {
      imageUrl = `https://placehold.co/400x150/1f2937/ffffff?text=${encodeURIComponent(cityName)}`;
    }
    return imageUrl;
  })();

  if (imageCache.size >= MAX_IMAGE_CACHE_SIZE) {
    const oldestKey = imageCache.keys().next().value;
    imageCache.delete(oldestKey);
  }

  imageCache.set(cityName, fetchPromise);
  return fetchPromise;
}

export function updateCurrentWeather(current, today, tempUnit, data) {
  if (!mainWeatherIcon || !currentTempEl || !feelsLikeTempEl || !currentDatetimeEl || !conditionIconEl || !conditionTextEl || !rainChanceEl || !locationNameEl || !locationImage) return;

  mainWeatherIcon.textContent = getWeatherIcon(current.icon);
  mainWeatherIcon.classList.remove("icon-pop");
  void mainWeatherIcon.offsetWidth; // Trigger reflow
  mainWeatherIcon.classList.add("icon-pop");

  currentTempEl.textContent = `${getDisplayTemp(current.temp)}${tempUnit}`;
  feelsLikeTempEl.textContent = `Feels like ${getDisplayTemp(current.feelslike)}${tempUnit}`;
  currentDatetimeEl.textContent = currentDatetimeFormatter.format(new Date());
  conditionIconEl.textContent = getWeatherIcon(current.icon);
  conditionTextEl.textContent = current.conditions;
  rainChanceEl.textContent = `Rain - ${Math.round(today.precipprob)}%`;
  
  const cityName = data.address.split(",")[0];
  let cleanAddress = data.resolvedAddress.replace(/^\d+\.\d+,-\d+\.\d+\s*,\s*/i, '');
  if (/^\d+\.\d+$/.test(cleanAddress.trim())) {
    cleanAddress = "Lat: " + cleanAddress.substring(0, 8) + ", Long: " + cleanAddress.split(",")[1]?.substring(0, 8);
  }
  if (!cleanAddress || cleanAddress.length < 2) {
    cleanAddress = cityName || data.address || "Unknown Location";
  }
  const displayLocation = cleanAddress;
  locationNameEl.textContent = displayLocation;
  
  document.title = `${Math.round(current.temp)}${tempUnit} in ${displayLocation} - Weather Dashboard`;
  locationImage.src = "";
  locationImage.classList.add('hidden');
  
  const parentContainer = locationImage.parentElement;
  parentContainer.querySelector('.image-fallback-gradient')?.remove();
  
  getCityImage(cityName).then(url => {
    if (url && !url.includes('placehold.co')) {
      locationImage.src = url;
      locationImage.classList.remove('hidden');
    } else {
      const fallbackDiv = document.createElement('div');
      fallbackDiv.className = 'image-fallback-gradient absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 flex flex-col items-center justify-center text-white p-4';
      
      const iconSpan = document.createElement('span');
      iconSpan.className = 'material-icons text-5xl opacity-40 animate-pulse';
      iconSpan.textContent = 'landscape';
      
      const citySpan = document.createElement('span');
      citySpan.className = 'text-xs uppercase tracking-widest font-black opacity-30 mt-1';
      citySpan.textContent = cityName;
      
      fallbackDiv.appendChild(iconSpan);
      fallbackDiv.appendChild(citySpan);
      parentContainer.insertBefore(fallbackDiv, parentContainer.firstChild);
    }
  });
}

export function updateUI() {
  if (!state.currentWeatherData || !state.currentWeatherData.days || state.currentWeatherData.days.length === 0) {
    if (!state.isInitialLoad) hideSkeleton();
    return;
  }

  const data = state.currentWeatherData;
  const today = data.days[0];
  const current = data.currentConditions || today.hours[0];
  const tempUnit = state.unitGroup === "metric" ? "°C" : "°F";
  const speedUnit = state.unitGroup === "metric" ? "km/h" : "mph";
  const distUnit = state.unitGroup === "metric" ? "km" : "mi";

  updateBackground(current.icon);
  updateCurrentWeather(current, today, tempUnit, data);
  updateHourlyForecast(today, tempUnit);
  updateWeeklyForecast(data, tempUnit);
  updateHighlights(today, current, speedUnit, distUnit);
  
  const convertedHours = today.hours.map(h => ({
    ...h,
    temp: typeof h.temp === 'number' ? getDisplayTemp(h.temp) : h.temp
  }));
  drawTempChart(convertedHours, tempUnit);
  
  updateRecentSearchesUI();
  updatePinButtonUI();
  showAlertBanner(data.alerts);

  if (data.minutely) {
    if (minutelyBars && data.minutely.length > 0) {
      const fragments = document.createDocumentFragment();
      const precipData = data.minutely.slice(0, 60);
      
      precipData.forEach(m => {
        const bar = document.createElement('div');
        const height = Math.min(48, (m.precip || 0) * 4);
        bar.className = 'flex-1 bg-blue-400 rounded-t transition-all';
        bar.style.height = height + 'px';
        bar.title = ` ${m.precip?.toFixed(1) || 0}%`;
        fragments.appendChild(bar);
      });
      minutelyBars.innerHTML = '';
      minutelyBars.appendChild(fragments);
    }
    if (minutelySummary) {
      minutelySummary.textContent = data.minutelySummary || "No precipitation expected";
    }
  }
}
