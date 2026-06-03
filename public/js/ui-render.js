import { state, getDisplayTemp } from './state.js';
import { getWeatherIcon, getWindDirection, formatTime, showError } from '../utils.js';
import { drawTempChart } from '../chart.js';
import { showPaymentModal } from './auth.js';

// Caches for weather data of saved locations
const savedWeatherCache = new Map();

// Helper to get dynamic icon colors depending on condition type
function getWeatherIconColor(iconName) {
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
async function getSavedLocationWeather(city) {
  if (savedWeatherCache.has(city)) {
    return savedWeatherCache.get(city);
  }
  try {
    const response = await fetch(`/api/weather?city=${encodeURIComponent(city)}`);
    if (response.ok) {
      const data = await response.json();
      const current = data.currentConditions || data.days[0].hours[0];
      const result = {
        temp: current.temp,
        icon: current.icon
      };
      savedWeatherCache.set(city, result);
      return result;
    }
  } catch (e) {
    console.error(`Failed to fetch weather for saved city ${city}:`, e);
  }
  return null;
}

// Helper to animate metric numbers counting up from 0
function animateCounter(element, targetValue, suffix = "", duration = 800) {
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
const shortWeekdayFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short" });

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

export function showSkeleton() {
  leftPanelContent?.classList.add("hidden");
  rightPanelContent?.classList.add("hidden");
  leftPanelSkeleton?.classList.remove("hidden");
  rightPanelSkeleton?.classList.remove("hidden");
}

export function hideSkeleton() {
  leftPanelContent?.classList.remove("hidden");
  rightPanelContent?.classList.remove("hidden");
  leftPanelSkeleton?.classList.add("hidden");
  rightPanelSkeleton?.classList.add("hidden");
}

export function toggleForecastView(view) {
  if (view === "today") {
    hourlySection?.classList.remove("view-hidden");
    weeklySection?.classList.add("view-hidden");
    if (todayButton) todayButton.className = "text-gray-900 dark:text-white font-bold text-lg border-b-4 border-blue-500 pb-1 interactive-element";
    if (weekButton) weekButton.className = "text-gray-500 dark:text-gray-400 font-bold text-lg interactive-element";
  } else {
    hourlySection?.classList.add("view-hidden");
    weeklySection?.classList.remove("view-hidden");
    if (weekButton) weekButton.className = "text-gray-900 dark:text-white font-bold text-lg border-b-4 border-blue-500 pb-1 interactive-element";
    if (todayButton) todayButton.className = "text-gray-500 dark:text-gray-400 font-bold text-lg interactive-element";
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

function getCityImage(cityName) {
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
      // Build a premium gradient fallback block matching condition colors
      const fallbackDiv = document.createElement('div');
      fallbackDiv.className = 'image-fallback-gradient absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 flex flex-col items-center justify-center text-white p-4';
      fallbackDiv.innerHTML = `
        <span class="material-icons text-5xl opacity-40 animate-pulse">landscape</span>
        <span class="text-xs uppercase tracking-widest font-black opacity-30 mt-1">${cityName}</span>
      `;
      parentContainer.insertBefore(fallbackDiv, parentContainer.firstChild);
    }
  });
}

export function updateHourlyForecast(today, tempUnit) {
  if (!hourlyContainer) return;
  hourlyContainer.innerHTML = "";
  const currentHour = new Date().getHours();
  const fragment = document.createDocumentFragment();
  today.hours
    .filter((h) => parseInt(h.datetime.substring(0, 2)) >= currentHour)
    .slice(0, 12)
    .forEach((h, index) => {
      const card = document.createElement("div");
      card.className = "bg-white/60 dark:bg-gray-800/60 backdrop-blur-md rounded-3xl p-5 text-center flex-shrink-0 min-w-[110px] interactive-element border border-white/20 fade-in-stagger";
      card.style.animationDelay = `${index * 50}ms`;
      card.innerHTML = `
              <p class="font-bold text-gray-500 dark:text-gray-400 text-sm mb-2">${index === 0 ? "Now" : formatTime(h.datetime)}</p>
              <span class="material-icons ${getWeatherIconColor(h.icon)} text-4xl my-2">${getWeatherIcon(h.icon)}</span>
              <p class="text-xl font-bold text-gray-800 dark:text-white mt-1">${getDisplayTemp(h.temp)}°</p>
          `;
      fragment.appendChild(card);
    });
  hourlyContainer.appendChild(fragment);
}

export function updateWeeklyForecast(data, tempUnit) {
  if (!forecastGrid) return;
  forecastGrid.innerHTML = "";
  
  // Always remove any existing upgrade prompts first to prevent duplication
  const existingPrompts = forecastGrid.parentElement?.querySelectorAll('[data-upgrade-prompt]');
  existingPrompts?.forEach(el => el.remove());
  
  const fragment = document.createDocumentFragment();
  
  const daysToShow = data.isLimited ? 3 : 7;
  const displayDays = data.days.slice(0, daysToShow);
  
  displayDays.forEach((day, index) => {
    const card = document.createElement("div");
    card.className = "bg-white/60 dark:bg-gray-800/60 backdrop-blur-md rounded-3xl p-5 text-center border border-white/20 interactive-element fade-in-stagger";
    card.style.animationDelay = `${index * 50}ms`;
    const date = new Date(day.datetime);
    card.innerHTML = `
              <p class="font-bold text-gray-500 dark:text-gray-400 text-sm mb-2">${index === 0 ? "Today" : shortWeekdayFormatter.format(date)}</p>
              <span class="material-icons ${getWeatherIconColor(day.icon)} text-4xl my-2">${getWeatherIcon(day.icon)}</span>
              <div class="flex justify-center space-x-2 mt-1">
                  <span class="text-lg font-bold text-gray-800 dark:text-white">${getDisplayTemp(day.tempmax)}°</span>
                  <span class="text-lg font-medium text-gray-400">${getDisplayTemp(day.tempmin)}°</span>
              </div>
          `;
    fragment.appendChild(card);
  });
  forecastGrid.appendChild(fragment);
  
  if (data.isLimited) {
    const upgradePrompt = document.createElement("div");
    upgradePrompt.className = "mt-4 text-center fade-in-stagger";
    upgradePrompt.setAttribute('data-upgrade-prompt', 'true');
    upgradePrompt.style.animationDelay = "350ms";
    upgradePrompt.innerHTML = `
      <div class="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/30 dark:to-orange-900/30 rounded-2xl p-4 border border-yellow-200 dark:border-yellow-700/50">
        <p class="text-sm text-yellow-800 dark:text-yellow-200 font-medium mb-2">Only showing 3-day forecast</p>
        <button id="upgrade-forecast-btn" class="inline-flex items-center px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-lg transition-colors">
          <span class="material-icons text-sm mr-1">star</span>
          Upgrade to see full 7-day forecast
        </button>
      </div>
    `;
    forecastGrid.parentElement?.appendChild(upgradePrompt);
    
    upgradePrompt.querySelector('#upgrade-forecast-btn')?.addEventListener('click', () => {
      showUpgradePrompt('7-day forecast');
    });
  }
}

export function updateHighlights(today, current, speedUnit, distUnit) {
  if (!highlightsGrid) return;
  const aqi = state.currentWeatherData?.aqi;
  let airQualityLabel = 'Coming Soon';
  let aqiColorClass = 'bg-gray-400';
  if (aqi !== null && aqi !== undefined) {
    if (aqi <= 50) {
      airQualityLabel = 'Good';
      aqiColorClass = 'bg-green-500';
    } else if (aqi <= 100) {
      airQualityLabel = 'Moderate';
      aqiColorClass = 'bg-yellow-500';
    } else if (aqi <= 150) {
      airQualityLabel = 'Unhealthy for Sensitive';
      aqiColorClass = 'bg-orange-500';
    } else if (aqi <= 200) {
      airQualityLabel = 'Unhealthy';
      aqiColorClass = 'bg-red-500';
    } else if (aqi <= 300) {
      airQualityLabel = 'Very Unhealthy';
      aqiColorClass = 'bg-purple-500';
    } else {
      airQualityLabel = 'Hazardous';
      aqiColorClass = 'bg-red-950';
    }
  }
  const pressure = current.pressure || 1013;
  const dewPoint = getDisplayTemp(current.dew);

  highlightsGrid.innerHTML = `
          <div class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md rounded-3xl p-6 border border-white/20 interactive-element">
              <p class="text-gray-500 dark:text-gray-400 font-bold text-sm flex items-center mb-4"><span class="material-icons text-xs mr-2">light_mode</span>UV Index</p>
              <div class="relative h-28 w-28 mx-auto">
                  <svg class="w-full h-full" viewBox="0 0 36 36">
                      <path class="text-gray-200 dark:text-gray-700" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="3"></path>
                      <path id="uv-progress" class="text-yellow-500 progress-bar-animated" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831" fill="none" stroke="currentColor" stroke-dasharray="0, 100" stroke-linecap="round" stroke-width="3"></path>
                  </svg>
                  <div class="absolute inset-0 flex flex-col items-center justify-center">
                      <span id="hl-uv-val" class="text-4xl font-bold text-gray-800 dark:text-white">0</span>
                      <span class="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">${today.uvindex > 5 ? "High" : "Low"}</span>
                  </div>
              </div>
          </div>
          <div class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md rounded-3xl p-6 border border-white/20 interactive-element">
              <p class="text-gray-500 dark:text-gray-400 font-bold text-sm flex items-center mb-4"><span class="material-icons text-xs mr-2">air</span>Wind Status</p>
              <p class="text-4xl font-black my-4 text-gray-800 dark:text-white tracking-tighter"><span id="hl-wind-val">0</span> <span class="text-xl font-medium text-gray-400">${speedUnit}</span></p>
              <div class="flex items-center text-blue-500 font-bold">
                  <span class="material-icons text-3xl" style="transform: rotate(${current.winddir}deg)">navigation</span>
                  <p class="ml-3 text-lg">${getWindDirection(current.winddir)}</p>
              </div>
          </div>
          <div class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md rounded-3xl p-6 border border-white/20 interactive-element">
              <p class="text-gray-500 dark:text-gray-400 font-bold text-sm flex items-center mb-4"><span class="material-icons text-xs mr-2">wb_twilight</span>Sunrise & Sunset</p>
              <div class="space-y-4 my-2">
                  <div class="flex items-center">
                      <div class="w-10 h-10 rounded-2xl bg-yellow-400/20 flex items-center justify-center mr-4">
                          <span class="material-icons text-yellow-500">arrow_upward</span>
                      </div>
                      <div>
                          <p class="text-sm font-bold text-gray-400">Sunrise</p>
                          <p class="text-xl font-black text-gray-800 dark:text-white">${formatTime(today.sunrise)}</p>
                      </div>
                  </div>
                  <div class="flex items-center">
                      <div class="w-10 h-10 rounded-2xl bg-orange-400/20 flex items-center justify-center mr-4">
                          <span class="material-icons text-orange-500">arrow_downward</span>
                      </div>
                      <div>
                          <p class="text-sm font-bold text-gray-400">Sunset</p>
                          <p class="text-xl font-black text-gray-800 dark:text-white">${formatTime(today.sunset)}</p>
                      </div>
                  </div>
              </div>
          </div>
          <div class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md rounded-3xl p-6 border border-white/20 interactive-element">
              <p class="text-gray-500 dark:text-gray-400 font-bold text-sm flex items-center mb-4"><span class="material-icons text-xs mr-2">water_drop</span>Humidity</p>
              <p class="text-4xl font-black my-4 text-gray-800 dark:text-white tracking-tighter"><span id="hl-humidity-val">0</span> <span class="text-xl font-medium text-gray-400">%</span></p>
              <p class="text-gray-500 dark:text-gray-400 font-medium mb-2">The dew point is ${dewPoint}° right now.</p>
              <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mt-4 overflow-hidden">
                  <div id="humidity-bar" class="bg-blue-500 h-2.5 rounded-full progress-bar-animated shadow-sm" style="width: 0%"></div>
              </div>
          </div>
          <div class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md rounded-3xl p-6 border border-white/20 interactive-element">
              <p class="text-gray-500 dark:text-gray-400 font-bold text-sm flex items-center mb-4"><span class="material-icons text-xs mr-2">visibility</span>Visibility</p>
              <p class="text-4xl font-black my-4 text-gray-800 dark:text-white tracking-tighter"><span id="hl-visibility-val">0</span> <span class="text-xl font-medium text-gray-400">${distUnit}</span></p>
              <p class="text-gray-500 dark:text-gray-400 font-medium mb-2">Pressure: ${pressure} hPa</p>
              <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mt-4 overflow-hidden">
                  <div id="visibility-bar" class="bg-emerald-500 h-2.5 rounded-full progress-bar-animated shadow-sm" style="width: 0%"></div>
              </div>
          </div>
          <div class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md rounded-3xl p-6 border border-white/20 interactive-element">
              <p class="text-gray-500 dark:text-gray-400 font-bold text-sm flex items-center mb-4"><span class="material-icons text-xs mr-2">waves</span>Air Quality</p>
              <p class="text-4xl font-black my-4 text-gray-800 dark:text-white tracking-tighter"><span id="hl-aqi-val">--</span></p>
              <p class="text-gray-500 dark:text-gray-400 font-medium mb-2">${airQualityLabel}</p>
              <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mt-4 overflow-hidden">
                  <div id="air-quality-bar" class="${aqiColorClass} h-2.5 rounded-full progress-bar-animated shadow-sm" style="width: 0%"></div>
              </div>
          </div>
      `;

  // Start numeric value animations
  animateCounter(document.getElementById('hl-uv-val'), today.uvindex);
  animateCounter(document.getElementById('hl-wind-val'), current.windspeed);
  animateCounter(document.getElementById('hl-humidity-val'), current.humidity);
  animateCounter(document.getElementById('hl-visibility-val'), current.visibility);
  if (aqi !== null && aqi !== undefined) {
    animateCounter(document.getElementById('hl-aqi-val'), aqi);
  }

  setTimeout(() => {
    const uvProgress = document.getElementById("uv-progress");
    const humidityBar = document.getElementById("humidity-bar");
    const visibilityBar = document.getElementById("visibility-bar");
    const airQualityBar = document.getElementById("air-quality-bar");

    if (uvProgress) {
      const uvCircumference = 2 * Math.PI * 15.9155;
      uvProgress.style.strokeDasharray = `${(today.uvindex / 12) * uvCircumference}, ${uvCircumference}`;
    }
    if (humidityBar) humidityBar.style.width = `${current.humidity}%`;
    if (visibilityBar) visibilityBar.style.width = `${Math.min(100, (current.visibility / 16) * 100)}%`;
    if (airQualityBar) {
      const aqiProgress = aqi !== null && aqi !== undefined ? Math.min(100, (aqi / 300) * 100) : 0;
      airQualityBar.style.width = `${aqiProgress}%`;
    }
  }, 100);
}

export function showAlertBanner(alerts) {
  if (!alertBanner || !alertText) return;

  if (!alerts || alerts.length === 0) {
    alertBanner.classList.add('-translate-y-44');
    alertBanner.classList.add('hidden');
    return;
  }
  
  // Determine severity of alerts
  const fullText = alerts.map(a => (a.event + " " + a.description).toLowerCase()).join(" ");
  const isSevere = ['warning', 'severe', 'extreme', 'emergency', 'tornado', 'hurricane', 'danger'].some(word => fullText.includes(word));
  
  const iconEl = document.getElementById('weather-alert-icon');
  
  if (isSevere) {
    alertBanner.className = "fixed top-4 left-1/2 -translate-x-1/2 max-w-xl w-[90%] mx-auto bg-red-600/95 dark:bg-red-700/95 backdrop-blur-md text-white px-5 py-4 rounded-3xl shadow-2xl z-40 transform transition-all duration-500 ease-out";
    if (iconEl) iconEl.textContent = "report_problem";
  } else {
    alertBanner.className = "fixed top-4 left-1/2 -translate-x-1/2 max-w-xl w-[90%] mx-auto bg-yellow-500/95 dark:bg-yellow-600/95 backdrop-blur-md text-white px-5 py-4 rounded-3xl shadow-2xl z-40 transform transition-all duration-500 ease-out";
    if (iconEl) iconEl.textContent = "warning";
  }

  const detailsEl = document.getElementById('weather-alert-details');
  const toggleBtn = document.getElementById('toggle-alert-details');

  if (alerts.length > 1) {
    alertText.textContent = `${alerts.length} Active Weather Alerts`;
    if (detailsEl) {
      detailsEl.innerHTML = alerts.map((alert, i) => 
        `<div class="border-b border-white/20 last:border-0 py-2">
          <div class="font-bold text-sm text-white">${alert.event || 'Extreme Weather'}</div>
          <div class="text-xs text-white/80 mt-1">${alert.description}</div>
         </div>`
      ).join('');
      detailsEl.classList.remove('hidden');
    }
    if (toggleBtn) toggleBtn.classList.add('hidden');
  } else {
    const alert = alerts[0];
    alertText.textContent = alert.event || 'Weather Alert';
    
    if (detailsEl && alert.description) {
      detailsEl.textContent = alert.description;
      detailsEl.classList.add('hidden');
      if (toggleBtn) {
        toggleBtn.classList.remove('hidden');
        toggleBtn.textContent = 'Read More';
        
        // Re-bind click listener cleanly by cloning button
        const newToggleBtn = toggleBtn.cloneNode(true);
        toggleBtn.replaceWith(newToggleBtn);
        newToggleBtn.addEventListener('click', () => {
          if (detailsEl.classList.contains('hidden')) {
            detailsEl.classList.remove('hidden');
            newToggleBtn.textContent = 'Show Less';
          } else {
            detailsEl.classList.add('hidden');
            newToggleBtn.textContent = 'Read More';
          }
        });
      }
    } else {
      if (detailsEl) detailsEl.classList.add('hidden');
      if (toggleBtn) toggleBtn.classList.add('hidden');
    }
  }
  
  alertBanner.classList.remove('hidden');
  void alertBanner.offsetWidth; // Trigger reflow
  alertBanner.classList.remove('-translate-y-44');
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
