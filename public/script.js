import { getWeatherIcon, getWindDirection, formatTime, showError } from './utils.js';
import { drawTempChart } from './chart.js';

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then((reg) => console.log("ServiceWorker registration successful."))
      .catch((err) => console.log("ServiceWorker registration failed: ", err));
  });
  
  // 🛡️ UX: Listen for service worker updates
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Show update notification
    const updateToast = document.createElement('div');
    updateToast.innerHTML = `
      <div class="flex items-center">
        <span class="material-icons mr-2">system_update</span>
        <span class="flex-grow">New version available!</span>
        <button id="update-reload-btn" class="ml-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-bold">Reload</button>
      </div>
    `;
    updateToast.className = 'fixed bottom-10 left-1/2 transform -translate-x-1/2 bg-gray-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl z-50 flex items-center';
    document.body.appendChild(updateToast);
    
    document.getElementById('update-reload-btn')?.addEventListener('click', () => {
      window.location.reload(true);
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  // 🛡️ Privacy: GDPR consent - Check for prior consent before using localStorage
  const CONSENT_KEY = 'weather_privacy_consent';
  const DATA_RETENTION_DAYS = 90;
  
  function checkPrivacyConsent() {
    const consent = localStorage.getItem(CONSENT_KEY);
    if (!consent) {
      // Show consent banner
      const consentBanner = document.createElement('div');
      consentBanner.innerHTML = `
        <div class="flex flex-col items-center p-4 bg-gray-900/95 backdrop-blur-md text-white">
          <p class="text-sm mb-3 text-center">We use localStorage to save your preferences and recent searches. By continuing, you agree to our data practices.</p>
          <div class="flex space-x-3">
            <button id="consent-accept" class="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-lg font-bold">Accept</button>
            <button id="consent-decline" class="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded-lg font-bold">Decline</button>
          </div>
        </div>
      `;
      consentBanner.className = 'fixed bottom-0 left-0 right-0 z-50 shadow-2xl';
      document.body.appendChild(consentBanner);
      
      document.getElementById('consent-accept')?.addEventListener('click', () => {
        localStorage.setItem(CONSENT_KEY, 'accepted');
        consentBanner.remove();
      });
      document.getElementById('consent-decline')?.addEventListener('click', () => {
        localStorage.setItem(CONSENT_KEY, 'declined');
        localStorage.removeItem('recentSearches');
        localStorage.removeItem('unitGroup');
        consentBanner.remove();
      });
    } else if (consent === 'accepted') {
      // Run data retention cleanup
      cleanupRetainedData();
    }
  }
  
  function cleanupRetainedData() {
    // 🛡️ Privacy: Data retention - Clean data older than 90 days
    try {
      const searches = JSON.parse(localStorage.getItem('recentSearches') || '[]');
      if (searches.length > 0) {
        const now = Date.now();
        const ttl = DATA_RETENTION_DAYS * 24 * 60 * 60 * 1000;
        const cutoff = now - ttl;
        // Filter out old entries (simple approach - just keep recent 5)
        const recent = searches.slice(0, 5);
        localStorage.setItem('recentSearches', JSON.stringify(recent));
      }
    } catch (e) {
      console.warn('Data cleanup error:', e);
    }
  }
  
  // Check consent on load
  checkPrivacyConsent();

  // DOM Version Check: If the HTML is cached and missing new elements, force a cache wipe and reload.
  if (!document.getElementById("recent-searches-container")) {
    console.warn("Outdated HTML detected. Clearing cache and reloading...");
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then(regs => {
            regs.forEach(reg => reg.unregister());
            window.location.reload(true);
          });
        } else {
          window.location.reload(true);
        }
      });
    } else {
      window.location.reload(true);
    }
    return; // Stop execution
  }

  const state = {
    unitGroup: localStorage.getItem("unitGroup") || "metric",
    currentWeatherData: null,
    isInitialLoad: true,
    recentSearches: JSON.parse(localStorage.getItem("recentSearches") || "[]").filter(c => !c.match(/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/)),
  };

  const loadingOverlay = document.getElementById("loading-overlay");
  const weatherDashboard = document.getElementById("weather-dashboard");
  const searchInput = document.getElementById("search-input");
  const todayButton = document.getElementById("today-button");
  const weekButton = document.getElementById("week-button");
  const hourlySection = document.getElementById("hourly-forecast-section");
  const weeklySection = document.getElementById("weekly-forecast-section");
  const geolocationButton = document.getElementById("geolocation-button");
  const celsiusButton = document.getElementById("celsius-button");
  const fahrenheitButton = document.getElementById("fahrenheit-button");
  const leftPanelContent = document.getElementById("left-panel-content");
  const leftPanelSkeleton = document.getElementById("left-panel-skeleton");
  const rightPanelContent = document.getElementById("right-panel-content");
  const rightPanelSkeleton = document.getElementById("right-panel-skeleton");
  const alertBanner = document.getElementById("weather-alert-banner");
  const alertText = document.getElementById("weather-alert-text");
  const closeAlertButton = document.getElementById("close-alert-button");
  const themeToggleButton = document.getElementById("theme-toggle");
  const logoutButton = document.getElementById("logout-button");
  const shareButton = document.getElementById("share-button");
  const compareButton = document.getElementById("compare-button");
  const recentSearchesContainer = document.getElementById(
    "recent-searches-container",
  );
  const recentSearchesList = document.getElementById("recent-searches-list");
  const autocompleteDropdown = document.getElementById("search-autocomplete-dropdown");
  const clearSearchButton = document.getElementById("clear-search-button");

  // ⚡ Bolt: Cache DOM elements at initialization to avoid redundant querying during rendering
  const mainWeatherIcon = document.getElementById("main-weather-icon");
  const currentTempEl = document.getElementById("current-temp");
  const feelsLikeTempEl = document.getElementById("feels-like-temp");
  const currentDatetimeEl = document.getElementById("current-datetime");
  const conditionIconEl = document.getElementById("condition-icon");
  const conditionTextEl = document.getElementById("condition-text");
  const rainChanceEl = document.getElementById("rain-chance");
  const locationNameEl = document.getElementById("location-name");
  const locationImage = document.getElementById("location-image");
  const hourlyContainer = document.getElementById("hourly-forecast-container");
  const forecastGrid = document.getElementById("forecast-grid");
  const highlightsGrid = document.getElementById("highlights-grid");
  const minutelyBars = document.getElementById('minutely-bars');
  const minutelySummary = document.getElementById('minutely-summary');

  let autocompleteTimeout;

  searchInput.addEventListener("input", (e) => {
    clearTimeout(autocompleteTimeout);
    const query = e.target.value.trim();
    // 🛡️ UX: Show/hide clear button based on input
    if (query.length > 0) {
      clearSearchButton.classList.remove("hidden");
    } else {
      clearSearchButton.classList.add("hidden");
    }
    if (query.length < 2) {
      autocompleteDropdown.classList.add("hidden");
      return;
    }
    autocompleteTimeout = setTimeout(() => fetchAutocomplete(query), 300);
  });

  // 🛡️ UX: Clear button handler
  clearSearchButton.addEventListener("click", () => {
    searchInput.value = "";
    clearSearchButton.classList.add("hidden");
    autocompleteDropdown.classList.add("hidden");
    searchInput.focus();
  });

  document.addEventListener("click", (e) => {
    if (!searchInput.contains(e.target) && !autocompleteDropdown.contains(e.target)) {
      autocompleteDropdown.classList.add("hidden");
    }
  });

  // 🛡️ Accessibility: Close autocomplete when keyboard focus moves outside
  document.addEventListener("focusin", (e) => {
    if (!searchInput.contains(e.target) && !autocompleteDropdown.contains(e.target)) {
      autocompleteDropdown.classList.add("hidden");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== searchInput) {
      e.preventDefault();
      searchInput.focus();
    }
  });

  // ⚡ Bolt: Cache autocomplete results to prevent redundant API calls on backspacing or re-typing
  const autocompleteCache = new Map();
  const MAX_AUTOCOMPLETE_CACHE_SIZE = 50;

  function fetchAutocomplete(query) {
    const lowercaseQuery = query.toLowerCase();

    // Check cache first
    if (autocompleteCache.has(lowercaseQuery)) {
      const cachedPromise = autocompleteCache.get(lowercaseQuery);
      // Refresh item for LRU eviction policy by re-inserting it.
      autocompleteCache.delete(lowercaseQuery);
      autocompleteCache.set(lowercaseQuery, cachedPromise);

      cachedPromise.then(results => {
        if (searchInput.value.trim().toLowerCase() === lowercaseQuery) {
          renderAutocomplete(results);
        }
      });
      return;
    }

    const fetchPromise = (async () => {
      try {
        const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`);
        if (!response.ok) return [];
        const data = await response.json();
        const results = data.results || [];
        return results;
      } catch (error) {
        console.error("Autocomplete fetch error: ", error);
        return [];
      }
    })();

    // Enforce cache size limit
    if (autocompleteCache.size >= MAX_AUTOCOMPLETE_CACHE_SIZE) {
      const oldestKey = autocompleteCache.keys().next().value;
      autocompleteCache.delete(oldestKey);
    }

    // ⚡ Bolt: Store the *promise* to deduplicate concurrent "in-flight" requests
    autocompleteCache.set(lowercaseQuery, fetchPromise);

    fetchPromise.then(results => {
      if (searchInput.value.trim().toLowerCase() === lowercaseQuery) {
        renderAutocomplete(results);
      }
    });
  }

  function renderAutocomplete(results) {
    autocompleteDropdown.innerHTML = "";
    if (results.length === 0) {
      autocompleteDropdown.classList.add("hidden");
      return;
    }

    // ⚡ Bolt: Use DocumentFragment to batch DOM appends
    // 🛡️ Accessibility: Add role="option" and keyboard navigation support
    const fragment = document.createDocumentFragment();
    results.forEach((result, index) => {
      const li = document.createElement("li");
      li.className = "px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-sm text-gray-800 dark:text-gray-200 border-b border-gray-100 dark:border-gray-700 last:border-0 truncate flex items-center";
      li.setAttribute("role", "option");
      li.setAttribute("tabindex", "0");
      li.setAttribute("data-index", index);
      
      const icon = document.createElement("span");
      icon.className = "material-icons text-gray-400 mr-2 text-sm";
      icon.textContent = "location_on";
      
      const textSpan = document.createElement("span");
      const locationText = [result.name, result.admin1, result.country].filter(Boolean).join(", ");
      textSpan.textContent = locationText;

      li.appendChild(icon);
      li.appendChild(textSpan);
      
      li.addEventListener("click", () => {
        searchInput.value = result.name;
        autocompleteDropdown.classList.add("hidden");
        startApp(locationText); 
      });
      
      fragment.appendChild(li);
    });

    autocompleteDropdown.appendChild(fragment);
    autocompleteDropdown.classList.remove("hidden");
  }

  // 🛡️ Accessibility: Add keyboard navigation for autocomplete
  function setupAutocompleteKeyboardNavigation() {
    let selectedIndex = -1;
    const items = () => autocompleteDropdown.querySelectorAll('[role="option"]');

    autocompleteDropdown.addEventListener("keydown", (e) => {
      const itemList = items();
      if (itemList.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          selectedIndex = Math.min(selectedIndex + 1, itemList.length - 1);
          updateSelection(itemList, selectedIndex);
          break;
        case "ArrowUp":
          e.preventDefault();
          selectedIndex = Math.max(selectedIndex - 1, 0);
          updateSelection(itemList, selectedIndex);
          break;
        case "Enter":
          if (selectedIndex >= 0) {
            e.preventDefault();
            itemList[selectedIndex].click();
          }
          break;
        case "Escape":
          autocompleteDropdown.classList.add("hidden");
          selectedIndex = -1;
          break;
      }
    });

    function updateSelection(itemList, index) {
      itemList.forEach((item, i) => {
        if (i === index) {
          item.classList.add("bg-blue-50", "dark:bg-blue-900");
          item.classList.remove("hover:bg-gray-100", "dark:hover:bg-gray-700");
          item.scrollIntoView({ block: "nearest" });
        } else {
          item.classList.remove("bg-blue-50", "dark:bg-blue-900");
          item.classList.add("hover:bg-gray-100", "dark:hover:bg-gray-700");
        }
      });
    }
  }

  // Initialize keyboard navigation
  setupAutocompleteKeyboardNavigation();

  function updateBackground(condition) {
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
    else if (condition.includes("cloud"))
      body.classList.add("weather-bg-cloudy");
    else if (condition.includes("storm"))
      body.classList.add("weather-bg-storm");
    else body.classList.add("weather-bg-clear");
  }

  function showSkeleton() {
    leftPanelContent.classList.add("hidden");
    rightPanelContent.classList.add("hidden");
    leftPanelSkeleton.classList.remove("hidden");
    rightPanelSkeleton.classList.remove("hidden");
  }

  function hideSkeleton() {
    leftPanelContent.classList.remove("hidden");
    rightPanelContent.classList.remove("hidden");
    leftPanelSkeleton.classList.add("hidden");
    rightPanelSkeleton.classList.add("hidden");
  }

    async function fetchWeatherData(location) {
        if (state.isInitialLoad) {
            loadingOverlay.style.display = 'flex';
        } else {
            showSkeleton();
        }
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

        const apiUrl = `/api/weather?location=${encodeURIComponent(location)}&unitGroup=${state.unitGroup}`;
        try {
            const response = await fetch(apiUrl, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            state.currentWeatherData = await response.json();
            addToRecentSearches(state.currentWeatherData.resolvedAddress);
            updateUI();
        } catch (error) {
            console.error("Error fetching weather data:", error);
            // 🛡️ UX: Differentiated error handling with type detection
            if (error.name === 'AbortError' || error.message?.includes('timeout')) {
                showError("Request timed out. Please try again.", 'timeout');
            } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
                showError("Network error. Please check your connection.", 'network');
            } else if (error.message?.includes('Weather service') || error.message?.includes('quota')) {
                showError(error.message || "Weather service unavailable.", 'api');
            } else {
                showError(error.message || "Location not found. Please try again.", 'location');
            }
            if (!state.isInitialLoad) hideSkeleton();
        } finally {
            if (state.isInitialLoad) {
                loadingOverlay.style.display = 'none';
                weatherDashboard.classList.remove('hidden');
                weatherDashboard.classList.add('flex');
                state.isInitialLoad = false;
            }
            // Expose refresh function for retry button
            window.triggerWeatherRefresh = () => {
                const currentLocation = locationNameEl.textContent;
                if (currentLocation && currentLocation !== '--') {
                    fetchWeatherData(currentLocation);
                }
            };
        }
    }

  function addToRecentSearches(address) {
    const city = address.split(",")[0].trim();
    if (!state.recentSearches.includes(city)) {
      state.recentSearches.unshift(city);
      if (state.recentSearches.length > 5) state.recentSearches.pop();
      localStorage.setItem(
        "recentSearches",
        JSON.stringify(state.recentSearches),
      );
      updateRecentSearchesUI();
    }
  }

  function updateRecentSearchesUI() {
    if (state.recentSearches.length === 0) {
      // 🛡️ UX: Show empty state message instead of hiding
      recentSearchesContainer.classList.remove("hidden");
      recentSearchesList.innerHTML = '<p class="text-xs text-gray-400 px-2">Search for a city to get weather</p>';
      return;
    }
    recentSearchesContainer.classList.remove("hidden");
    recentSearchesList.innerHTML = "";
    // ⚡ Bolt: Use DocumentFragment to batch DOM appends
    const fragment = document.createDocumentFragment();
    state.recentSearches.forEach((city) => {
      const btn = document.createElement("button");
      btn.className =
        "bg-white/30 dark:bg-gray-700/50 hover:bg-white/50 dark:hover:bg-gray-600/50 text-gray-800 dark:text-white text-xs font-bold px-3 py-1.5 rounded-full transition-all interactive-element";
      btn.textContent = city;
      btn.onclick = () => fetchWeatherData(city);
      fragment.appendChild(btn);
    });
    recentSearchesList.appendChild(fragment);
  }

  function showAlertBanner(alerts) {
    if (!alerts || alerts.length === 0) {
      alertBanner.classList.add('-translate-y-full');
      alertBanner.classList.add('hidden');
      return;
    }
    
    // 🛡️ UX: Display multiple alerts stacked vertically
    if (alerts.length > 1) {
      // Clear existing and show multi-alert banner
      alertText.innerHTML = alerts.map((alert, i) => 
        `<div class="alert-item border-b border-yellow-600/30 last:border-0 py-1">
          <strong>${alert.event}:</strong> ${alert.headline}
         </div>`
      ).join('');
      alertBanner.classList.remove('hidden');
      setTimeout(() => alertBanner.classList.remove('-translate-y-full'), 100);
    } else {
      // Single alert - show as before
      const alert = alerts[0];
      alertText.textContent = `${alert.event}: ${alert.headline}`;
      alertBanner.classList.remove('hidden');
      setTimeout(() => alertBanner.classList.remove('-translate-y-full'), 100);
    }
  }

  function updateUI() {
    if (
      !state.currentWeatherData ||
      !state.currentWeatherData.days ||
      state.currentWeatherData.days.length === 0
    ) {
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
    drawTempChart(today.hours, tempUnit);
    updateRecentSearchesUI();
    showAlertBanner(data.alerts);

    // 🔗 Phase 11.5: Render minutely precipitation if available
    if (data.minutely) {
      if (minutelyBars && data.minutely.length > 0) {
        const fragments = document.createDocumentFragment();
        const precipData = data.minutely.slice(0, 60);
        let totalPrecip = 0;
        
        precipData.forEach(m => {
          totalPrecip += m.precip || 0;
          const bar = document.createElement('div');
          const height = Math.min(48, (m.precip || 0) * 4);
          bar.className = 'flex-1 bg-blue-400 rounded-t transition-all';
          bar.style.height = height + 'px';
          bar.title = ` ${m.precip?.toFixed(1) || 0}%`;
          fragments.appendChild(bar);
        });
        minutelyBars.innerHTML = '';
        minutelyBars.appendChild(fragments);
        
        if (totalPrecip > 10) {
          minutelySummary.textContent = `${totalPrecip.toFixed(0)}mm expected in the next hour`;
        } else if (totalPrecip > 0) {
          minutelySummary.textContent = `Light precipitation expected`;
        } else {
          minutelySummary.textContent = 'No precipitation expected';
        }
      } else if (minutelySummary) {
        minutelySummary.textContent = 'No precipitation data available';
      }
    }

    if (!state.isInitialLoad) hideSkeleton();
  }

  // ⚡ Bolt: Cache city images to prevent redundant network requests on unit toggle or repeated searches
  const imageCache = new Map();
  // ⚡ Bolt: Prevent memory exhaustion from unbounded image cache growth
  const MAX_IMAGE_CACHE_SIZE = 50;

  function getCityImage(cityName) {
    if (imageCache.has(cityName)) {
      // ⚡ Bolt: LRU eviction logic - refresh item by moving it to the end of the Map
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

    // ⚡ Bolt: Store the *promise* to deduplicate concurrent "in-flight" requests
    if (imageCache.size >= MAX_IMAGE_CACHE_SIZE) {
      const oldestKey = imageCache.keys().next().value;
      imageCache.delete(oldestKey);
    }

    imageCache.set(cityName, fetchPromise);
    return fetchPromise;
  }

  function updateCurrentWeather(current, today, tempUnit, data) {
    mainWeatherIcon.textContent = getWeatherIcon(current.icon);
    mainWeatherIcon.classList.remove("icon-pop");
    void mainWeatherIcon.offsetWidth; // Trigger reflow
    mainWeatherIcon.classList.add("icon-pop");

    currentTempEl.textContent =
      `${Math.round(current.temp)}${tempUnit}`;
    feelsLikeTempEl.textContent =
      `Feels like ${Math.round(current.feelslike)}${tempUnit}`;
    currentDatetimeEl.textContent =
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        hour: "2-digit",
        minute: "2-digit",
      });
    conditionIconEl.textContent = getWeatherIcon(
      current.icon,
    );
    conditionTextEl.textContent = current.conditions;
    rainChanceEl.textContent =
      `Rain - ${Math.round(today.precipprob)}%`;
    
    // Clean the city name - remove raw coordinates and handle edge cases
    const cityName = data.address.split(",")[0];
    // Filter out coordinate-like patterns from resolved address
    let cleanAddress = data.resolvedAddress.replace(/^\d+\.\d+,-\d+\.\d+\s*,\s*/i, '');
    // Also handle if just numeric coordinates with no city name at all
    if (/^\d+\.\d+$/.test(cleanAddress.trim())) {
      // It's just coordinates, use a fallback location name
      cleanAddress = "Lat: " + cleanAddress.substring(0, 8) + ", Long: " + cleanAddress.split(",")[1]?.substring(0, 8);
    }
    // Handle very short/invalid names
    if (!cleanAddress || cleanAddress.length < 2) {
      cleanAddress = cityName || data.address || "Unknown Location";
    }
    const displayLocation = cleanAddress;
    locationNameEl.textContent = displayLocation;
    
    // 🛡️ UX: Update page title with current context so users with multiple tabs can easily see the weather
    document.title = `${Math.round(current.temp)}${tempUnit} in ${displayLocation} - Weather Dashboard`;

    // Set loading placeholder immediately
    locationImage.src = `https://placehold.co/400x150/1f2937/ffffff?text=Loading...`;
    locationImage.alt = `Cityscape or landmark of ${displayLocation}`;
    // Show image card
    locationImage.parentElement.classList.remove('hidden');
    
    // Fetch city image from Wikipedia
    getCityImage(cityName).then(url => {
      locationImage.src = url;
    });
  }

  function updateHourlyForecast(today, tempUnit) {
    hourlyContainer.innerHTML = "";
    const currentHour = new Date().getHours();
    // ⚡ Bolt: Use DocumentFragment to batch DOM appends
    const fragment = document.createDocumentFragment();
    today.hours
      .filter((h) => parseInt(h.datetime.substring(0, 2)) >= currentHour)
      .slice(0, 12)
      .forEach((h, index) => {
        const card = document.createElement("div");
        card.className =
          "bg-white/60 dark:bg-gray-800/60 backdrop-blur-md rounded-3xl p-5 text-center flex-shrink-0 min-w-[110px] interactive-element border border-white/20 fade-in-stagger";
        card.style.animationDelay = `${index * 50}ms`;
        card.innerHTML = `
                <p class="font-bold text-gray-500 dark:text-gray-400 text-sm mb-2">${index === 0 ? "Now" : formatTime(h.datetime)}</p>
                <span class="material-icons text-blue-500 dark:text-blue-400 text-4xl my-2">${getWeatherIcon(h.icon)}</span>
                <p class="text-xl font-bold text-gray-800 dark:text-white mt-1">${Math.round(h.temp)}°</p>
            `;
        fragment.appendChild(card);
      });
    hourlyContainer.appendChild(fragment);
  }

  function updateWeeklyForecast(data, tempUnit) {
    forecastGrid.innerHTML = "";
    // ⚡ Bolt: Use DocumentFragment to batch DOM appends
    const fragment = document.createDocumentFragment();
    
    // Get the number of days to display based on tier
    const daysToShow = data.isLimited ? 3 : 7;
    const displayDays = data.days.slice(0, daysToShow);
    
    displayDays.forEach((day, index) => {
      const card = document.createElement("div");
      card.className =
        "bg-white/60 dark:bg-gray-800/60 backdrop-blur-md rounded-3xl p-5 text-center border border-white/20 interactive-element fade-in-stagger";
      card.style.animationDelay = `${index * 50}ms`;
      const date = new Date(day.datetime);
      card.innerHTML = `
                <p class="font-bold text-gray-500 dark:text-gray-400 text-sm mb-2">${index === 0 ? "Today" : date.toLocaleDateString("en-US", { weekday: "short" })}</p>
                <span class="material-icons text-yellow-500 text-4xl my-2">${getWeatherIcon(day.icon)}</span>
                <div class="flex justify-center space-x-2 mt-1">
                    <span class="text-lg font-bold text-gray-800 dark:text-white">${Math.round(day.tempmax)}°</span>
                    <span class="text-lg font-medium text-gray-400">${Math.round(day.tempmin)}°</span>
                </div>
            `;
      fragment.appendChild(card);
    });
    forecastGrid.appendChild(fragment);
    
    // 🎯 Subscription Tier UI: Show upgrade prompt when forecast is limited
    if (data.isLimited) {
      const upgradePrompt = document.createElement("div");
      upgradePrompt.className = "mt-4 text-center fade-in-stagger";
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
      
      // Add upgrade button handler
      upgradePrompt.querySelector('#upgrade-forecast-btn')?.addEventListener('click', () => {
        showUpgradePrompt('7-day forecast');
      });
    } else {
      // Remove any existing upgrade prompt if showing full forecast
      const existingPrompt = forecastGrid.parentElement?.querySelector('.bg-gradient-to-r.from-yellow-50');
      if (existingPrompt) {
        existingPrompt.remove();
      }
    }
  }

  function updateHighlights(today, current, speedUnit, distUnit) {
    // Air Quality: Using a placeholder since Visual Crossing doesn't provide real-time AQ data
    // Future: Integrate with WAQI or OpenWeatherMap Pollution API
    const airQuality = null; // Real AQ data requires additional API integration
    const airQualityLabel = 'Coming Soon';
    const pressure = current.pressure || 1013;
    const dewPoint = current.dew || 0;

    highlightsGrid.innerHTML = `
            <div class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md rounded-3xl p-6 border border-white/20 interactive-element">
                <p class="text-gray-500 dark:text-gray-400 font-bold text-sm flex items-center mb-4"><span class="material-icons text-xs mr-2">light_mode</span>UV Index</p>
                <div class="relative h-28 w-28 mx-auto">
                    <svg class="w-full h-full" viewBox="0 0 36 36">
                        <path class="text-gray-200 dark:text-gray-700" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="3"></path>
                        <path id="uv-progress" class="text-yellow-500 progress-bar-animated" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831" fill="none" stroke="currentColor" stroke-dasharray="0, 100" stroke-linecap="round" stroke-width="3"></path>
                    </svg>
                    <div class="absolute inset-0 flex flex-col items-center justify-center">
                        <span class="text-4xl font-bold text-gray-800 dark:text-white">${today.uvindex}</span>
                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">${today.uvindex > 5 ? "High" : "Low"}</span>
                    </div>
                </div>
            </div>
            <div class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md rounded-3xl p-6 border border-white/20 interactive-element">
                <p class="text-gray-500 dark:text-gray-400 font-bold text-sm flex items-center mb-4"><span class="material-icons text-xs mr-2">air</span>Wind Status</p>
                <p class="text-4xl font-black my-4 text-gray-800 dark:text-white tracking-tighter">${current.windspeed} <span class="text-xl font-medium text-gray-400">${speedUnit}</span></p>
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
                <p class="text-4xl font-black my-4 text-gray-800 dark:text-white tracking-tighter">${Math.round(current.humidity)} <span class="text-xl font-medium text-gray-400">%</span></p>
                <p class="text-gray-500 dark:text-gray-400 font-medium mb-2">The dew point is ${dewPoint}° right now.</p>
                <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mt-4 overflow-hidden">
                    <div id="humidity-bar" class="bg-blue-500 h-2.5 rounded-full progress-bar-animated shadow-sm" style="width: 0%"></div>
                </div>
            </div>
            <div class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md rounded-3xl p-6 border border-white/20 interactive-element">
                <p class="text-gray-500 dark:text-gray-400 font-bold text-sm flex items-center mb-4"><span class="material-icons text-xs mr-2">visibility</span>Visibility</p>
                <p class="text-4xl font-black my-4 text-gray-800 dark:text-white tracking-tighter">${current.visibility} <span class="text-xl font-medium text-gray-400">${distUnit}</span></p>
                <p class="text-gray-500 dark:text-gray-400 font-medium mb-2">Pressure: ${pressure} hPa</p>
                <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mt-4 overflow-hidden">
                    <div id="visibility-bar" class="bg-emerald-500 h-2.5 rounded-full progress-bar-animated shadow-sm" style="width: 0%"></div>
                </div>
            </div>
            <div class="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md rounded-3xl p-6 border border-white/20 interactive-element">
                <p class="text-gray-500 dark:text-gray-400 font-bold text-sm flex items-center mb-4"><span class="material-icons text-xs mr-2">waves</span>Air Quality</p>
                <p class="text-4xl font-black my-4 text-gray-800 dark:text-white tracking-tighter">--</p>
                <p class="text-gray-500 dark:text-gray-400 font-medium mb-2">${airQualityLabel}</p>
                <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mt-4 overflow-hidden">
                    <div id="air-quality-bar" class="bg-gray-400 h-2.5 rounded-full progress-bar-animated shadow-sm" style="width: 0%"></div>
                </div>
            </div>
        `;

    setTimeout(() => {
      const uvCircumference = 2 * Math.PI * 15.9155;
      document.getElementById("uv-progress").style.strokeDasharray =
        `${(today.uvindex / 12) * uvCircumference}, ${uvCircumference}`;
      document.getElementById("humidity-bar").style.width =
        `${current.humidity}%`;
      document.getElementById("visibility-bar").style.width =
        `${Math.min(100, (current.visibility / 16) * 100)}%`;
      // Air quality placeholder - no bar animation since no real data
      document.getElementById("air-quality-bar").style.width = '0%';
    }, 100);
  }

  function toggleForecastView(view) {
    if (view === "today") {
      hourlySection.classList.remove("view-hidden");
      weeklySection.classList.add("view-hidden");
      todayButton.className =
        "text-gray-900 dark:text-white font-bold text-lg border-b-4 border-blue-500 pb-1 interactive-element";
      weekButton.className =
        "text-gray-500 dark:text-gray-400 font-bold text-lg interactive-element";
    } else {
      hourlySection.classList.add("view-hidden");
      weeklySection.classList.remove("view-hidden");
      weekButton.className =
        "text-gray-900 dark:text-white font-bold text-lg border-b-4 border-blue-500 pb-1 interactive-element";
      todayButton.className =
        "text-gray-500 dark:text-gray-400 font-bold text-lg interactive-element";
    }
  }

  // ⚡ Performance: Helper function for in-place unit conversion
  function convertTemperature(value, toUnit) {
    if (toUnit === 'us') {
      // Celsius to Fahrenheit
      return Math.round(value * 9/5 + 32);
    } else {
      // Fahrenheit to Celsius
      return Math.round((value - 32) * 5/9);
    }
  }

  function setUnit(unit) {
    if (state.unitGroup === unit) return;
    const oldUnit = state.unitGroup;
    state.unitGroup = unit;
    // 🛡️ Persistence: Save unit preference to localStorage
    localStorage.setItem('unitGroup', unit);
    
    if (unit === "metric") {
      celsiusButton.className =
        "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-md rounded-xl px-3 py-1.5 flex items-center justify-center font-bold text-sm interactive-element";
      fahrenheitButton.className =
        "px-3 py-1.5 flex items-center justify-center font-bold text-sm text-gray-500 dark:text-gray-400 interactive-element";
    } else {
      fahrenheitButton.className =
        "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-md rounded-xl px-3 py-1.5 flex items-center justify-center font-bold text-sm interactive-element";
      celsiusButton.className =
        "px-3 py-1.5 flex items-center justify-center font-bold text-sm text-gray-500 dark:text-gray-400 interactive-element";
    }
    
    // ⚡ Performance: Convert temperatures in-place without API refetch
    if (state.currentWeatherData) {
      const current = state.currentWeatherData.currentConditions;
      const today = state.currentWeatherData.days[0];
      const tempUnit = unit === "metric" ? "°C" : "°F";
      
      // Convert current temperature display
      if (currentTempEl.textContent) {
        const oldTemp = parseInt(currentTempEl.textContent);
        currentTempEl.textContent = `${convertTemperature(oldTemp, unit)}${tempUnit}`;
      }
      // Convert feels like
      if (feelsLikeTempEl.textContent && current) {
        const oldFeels = Math.round(oldUnit === 'metric' ? (current.feelslike * 9/5 + 32) : (current.feelslike - 32) * 5/9);
        feelsLikeTempEl.textContent = `Feels like ${oldFeels}${tempUnit}`;
      }
      
      // Update all temperature displays in the UI
      updateUI();
    }
  }

  function setTheme(theme) {
    localStorage.setItem("theme", theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      themeToggleButton.querySelector(".material-icons").textContent =
        "dark_mode";
    } else {
      document.documentElement.classList.remove("dark");
      themeToggleButton.querySelector(".material-icons").textContent =
        "light_mode";
    }
  }

  todayButton.addEventListener("click", () => toggleForecastView("today"));
  weekButton.addEventListener("click", () => toggleForecastView("week"));
  celsiusButton.addEventListener("click", () => setUnit("metric"));
  fahrenheitButton.addEventListener("click", () => setUnit("us"));
  searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && searchInput.value.trim()) {
      const location = searchInput.value.trim();
      // 🔗 Navigation: Update URL on search
      if (typeof updateLocationUrl === 'function') {
        updateLocationUrl(location);
      }
      fetchWeatherData(location);
      searchInput.value = "";
    } else if (e.key === "Enter" && !searchInput.value.trim()) {
      // 🛡️ UX: Show validation error for empty search
      showError("Please enter a city name to search.");
    }
  });

  geolocationButton.addEventListener("click", () => {
    if (navigator.geolocation) {
      // 🛡️ UX: Show loading state during geolocation
      const originalIcon = geolocationButton.querySelector('.material-icons').textContent;
      geolocationButton.querySelector('.material-icons').textContent = 'hourglass_empty';
      geolocationButton.disabled = true;
      geolocationButton.classList.add('opacity-50', 'cursor-not-allowed');
      
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          try {
            const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
            if (response.ok) {
              const data = await response.json();
              const city = data.city || data.locality || `${lat},${lon}`;
              fetchWeatherData(city);
            } else {
              fetchWeatherData(`${lat},${lon}`);
            }
          } catch (e) {
            fetchWeatherData(`${lat},${lon}`);
          } finally {
            // Restore button state
            geolocationButton.querySelector('.material-icons').textContent = originalIcon;
            geolocationButton.disabled = false;
            geolocationButton.classList.remove('opacity-50', 'cursor-not-allowed');
          }
        },
        (error) => {
          showError("Could not get your location. Please search manually.");
          // Restore button state
          geolocationButton.querySelector('.material-icons').textContent = originalIcon;
          geolocationButton.disabled = false;
          geolocationButton.classList.remove('opacity-50', 'cursor-not-allowed');
        },
        { timeout: 5000 }
      );
    } else {
      showError("Geolocation is not supported by this browser.");
    }
  });

  closeAlertButton.addEventListener("click", () => {
    alertBanner.classList.add("-translate-y-full");
  });

  // 🔗 Phase 11.8: Freemium API Service Integration
  const AUTH_KEY = 'weather_auth_token';
  const USER_KEY = 'weather_user_data';
  
  // Store auth token
  function storeAuth(token, user) {
    localStorage.setItem(AUTH_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
  
  // Get stored auth
  function getAuth() {
    return {
      token: localStorage.getItem(AUTH_KEY),
      user: JSON.parse(localStorage.getItem(USER_KEY) || 'null')
    };
  }
  
  // Clear auth (logout)
  function clearAuth() {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(USER_KEY);
  }
  
  // Frontend API call wrapper with auth
  async function authFetch(url, options = {}) {
    const { token } = getAuth();
    if (token) {
      options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`
      };
    }
    return fetch(url, options);
  }
  
  // Show upgrade prompt for premium features
  function showUpgradePrompt(feature) {
    const prompt = document.createElement('div');
    prompt.className = 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4';
    prompt.innerHTML = `
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 max-w-sm text-center">
        <span class="material-icons text-4xl text-yellow-500">star</span>
        <h3 class="text-xl font-bold text-gray-800 dark:text-white mt-2">Premium Feature</h3>
        <p class="text-gray-500 mt-2">${feature} requires a premium subscription.</p>
        <div class="flex justify-center space-x-3 mt-4">
          <button id="upgrade-cancel" class="px-4 py-2 text-gray-500">Maybe Later</button>
          <button id="upgrade-btn" class="px-4 py-2 bg-yellow-500 text-white font-bold rounded-lg">Upgrade Now</button>
        </div>
      </div>
    `;
    document.body.appendChild(prompt);
    
    prompt.querySelector('#upgrade-cancel')?.addEventListener('click', () => prompt.remove());
    prompt.querySelector('#upgrade-btn')?.addEventListener('click', () => {
      // Would open upgrade flow
      prompt.remove();
      showError('Premium upgrade coming soon!', 'generic');
    });
  }
  
  // Register/Login UI handlers (simplified for this implementation)
  async function registerUser(email, password, isPremium = false) {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, tier: isPremium ? 'premium' : 'free' })
      });
      const data = await response.json();
      if (response.ok && data.token) {
        storeAuth(data.token, data.user);
        return { success: true, user: data.user };
      }
      return { success: false, error: data.error };
    } catch (e) {
      return { success: false, error: 'Registration failed' };
    }
  }
  
  async function loginUser(email, password) {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      if (response.ok && data.token) {
        storeAuth(data.token, data.user);
        return { success: true, user: data.user };
      }
      return { success: false, error: data.error };
    } catch (e) {
      return { success: false, error: 'Login failed' };
    }
  }

  // Logout user - clears all storage and redirects
  async function logoutUser() {
    const { token } = getAuth();
    
    // Show loading state
    if (logoutButton) {
      logoutButton.disabled = true;
      logoutButton.querySelector('.material-icons').textContent = 'hourglass_empty';
      logoutButton.classList.add('opacity-50', 'cursor-not-allowed');
    }
    
    try {
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      }
    } catch (error) {
      console.warn('Server logout failed:', error);
    } finally {
      // Clear localStorage
      localStorage.removeItem(AUTH_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem('recentSearches');
      localStorage.removeItem('unitGroup');
      localStorage.removeItem('theme');
      localStorage.removeItem('weather_onboarding_complete');
      localStorage.removeItem('weather_privacy_consent');
      
      // Clear sessionStorage
      sessionStorage.clear();
      
      // Clear cookies
      const cookies = document.cookie.split(';');
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i];
        const eqIdx = cookie.indexOf('=');
        const name = eqIdx > -1 ? cookie.substring(0, eqIdx).trim() : cookie.trim();
        document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/';
      }
      
      // Redirect to landing page
      window.location.href = '/landing.html';
    }
  }

  // 🔗 Phase 11.2: Multiple Location Comparison
  let compareMode = false;
  let comparisonData = null;
  const comparisonPanel = document.createElement('div');
  comparisonPanel.id = 'comparison-panel';
  comparisonPanel.className = 'hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4';
  comparisonPanel.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-auto p-6">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-bold text-gray-800 dark:text-white">Compare Weather</h2>
        <button id="close-compare" class="material-icons text-gray-500 hover:text-gray-700" aria-label="Close comparison" title="Close comparison">close</button>
      </div>
      <div class="grid grid-cols-2 gap-4" id="compare-content"></div>
    </div>
  `;
  document.body.appendChild(comparisonPanel);
  
  function renderComparison() {
    const content = document.getElementById('compare-content');
    const current = state.currentWeatherData;
    
    if (!current || !comparisonData) {
      content.innerHTML = '<p class="text-gray-500 col-span-2">Select two locations to compare</p>';
      return;
    }
    
    const loc1 = current.resolvedAddress;
    const loc2 = comparisonData.resolvedAddress;
    const temp1 = current.currentConditions?.temp;
    const temp2 = comparisonData.currentConditions?.temp;
    const cond1 = current.currentConditions?.conditions;
    const cond2 = comparisonData.currentConditions?.conditions;
    const unit = state.unitGroup === 'metric' ? '°C' : '°F';
    
    content.innerHTML = `
      <div class="bg-blue-50 dark:bg-gray-700 rounded-2xl p-4 text-center">
        <p class="font-bold text-gray-800 dark:text-white mb-2">${loc1}</p>
        <p class="text-4xl font-black text-gray-800 dark:text-white">${Math.round(temp1)}${unit}</p>
        <p class="text-gray-500">${cond1}</p>
      </div>
      <div class="bg-purple-50 dark:bg-gray-700 rounded-2xl p-4 text-center">
        <p class="font-bold text-gray-800 dark:text-white mb-2">${loc2}</p>
        <p class="text-4xl font-black text-gray-800 dark:text-white">${Math.round(temp2)}${unit}</p>
        <p class="text-gray-500">${cond2}</p>
      </div>
    `;
  }
  
  compareButton?.addEventListener('click', async () => {
    if (compareMode) {
      comparisonPanel.classList.add('hidden');
      compareMode = false;
      return;
    }
    
    // Show comparison modal
    comparisonPanel.classList.remove('hidden');
    renderComparison();
    
    // Prompt for second location
    const secondLocation = prompt('Enter a second location to compare weather:');
    if (secondLocation) {
      try {
        const response = await fetch(`/api/weather?location=${encodeURIComponent(secondLocation)}&unitGroup=${state.unitGroup}`);
        if (response.ok) {
          comparisonData = await response.json();
          renderComparison();
        } else {
          showError('Could not fetch weather for comparison location', 'location');
        }
      } catch (e) {
        showError('Comparison failed', 'network');
      }
    }
    
    compareMode = true;
  });
  
  document.getElementById('close-compare')?.addEventListener('click', () => {
    comparisonPanel.classList.add('hidden');
    compareMode = false;
    comparisonData = null;
  });

  // 🔗 Phase 11.4: Onboarding Tutorial for first-time users
  const ONBOARDING_KEY = 'weather_onboarding_complete';
  
  function showOnboarding() {
    if (localStorage.getItem(ONBOARDING_KEY)) return;
    
    const tourSteps = [
      { target: '#search-input', message: 'Search for any city worldwide' },
      { target: '#geolocation-button', message: 'Or get your current location' },
      { target: '#today-button', message: 'Switch between hourly and weekly forecasts' },
      { target: '#celsius-button', message: 'Toggle temperature units' },
      { target: '#theme-toggle', message: 'Switch between light and dark mode' }
    ];
    
    let currentStep = 0;
    
    const tourOverlay = document.createElement('div');
    tourOverlay.id = 'tour-overlay';
    tourOverlay.className = 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center';
    tourOverlay.innerHTML = `
      <div class="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-2xl max-w-sm text-center">
        <div class="mb-4">
          <span class="material-icons text-4xl text-blue-500">explore</span>
        </div>
        <p id="tour-message" class="text-lg font-bold text-gray-800 dark:text-white mb-4"></p>
        <div class="flex justify-center space-x-3">
          <button id="tour-skip" class="text-sm text-gray-500 hover:text-gray-700">Skip</button>
          <button id="tour-next" class="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-bold">Next</button>
        </div>
      </div>
    `;
    document.body.appendChild(tourOverlay);
    
    function updateTourStep() {
      if (currentStep >= tourSteps.length) {
        localStorage.setItem(ONBOARDING_KEY, 'true');
        tourOverlay.remove();
        return;
      }
      const step = tourSteps[currentStep];
      document.getElementById('tour-message').textContent = step.message;
    }
    
    updateTourStep();
    
    document.getElementById('tour-next').addEventListener('click', () => {
      currentStep++;
      updateTourStep();
    });
    
    document.getElementById('tour-skip').addEventListener('click', () => {
      localStorage.setItem(ONBOARDING_KEY, 'true');
      tourOverlay.remove();
    });
  }
  
  // Show onboarding after consent check
  setTimeout(showOnboarding, 1500);

  // 🔗 Phase 11.3: Share API Integration
  shareButton?.addEventListener("click", async () => {
    if (!navigator.share) {
      // Fallback: Copy URL to clipboard
      try {
        await navigator.clipboard.writeText(window.location.href);
        showError("Link copied to clipboard!", 'generic');
      } catch (e) {
        showError("Sharing not supported", 'generic');
      }
      return;
    }
    
    const current = state.currentWeatherData;
    const temp = current?.currentConditions?.temp || '--';
    const conditions = current?.currentConditions?.conditions || 'Weather';
    const location = current?.resolvedAddress || 'Weather';
    
    try {
      await navigator.share({
        title: `Weather in ${location}`,
        text: `Current weather in ${location}: ${temp}° - ${conditions}`,
        url: window.location.href
      });
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error('Share failed:', e);
      }
    }
  });

  themeToggleButton.addEventListener("click", () => {
    const newTheme = document.documentElement.classList.contains("dark")
      ? "light"
      : "dark";
    setTheme(newTheme);
  });

  logoutButton?.addEventListener("click", async () => {
    await logoutUser();
  });

  // Handle window resize for chart
  let resizeTimer;
  window.addEventListener("resize", () => {
    if (!state.currentWeatherData) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      drawTempChart(
        state.currentWeatherData.days[0].hours,
        state.unitGroup === "metric" ? "°C" : "°F",
      );
    }, 200);
  });

  // 🛡️ UX: Pull-to-refresh on mobile
  let pullStartY = 0;
  let pullDistance = 0;
  const PULL_THRESHOLD = 100;
  const pullIndicator = document.createElement('div');
  pullIndicator.className = 'fixed top-0 left-0 right-0 bg-blue-500 text-white text-center py-2 text-sm font-bold z-50 transform -translate-y-full transition-transform duration-200';
  pullIndicator.textContent = '↓ Pull to refresh';
  document.body.appendChild(pullIndicator);

  document.addEventListener('touchstart', (e) => {
    if (window.scrollY === 0) {
      pullStartY = e.touches[0].clientY;
    }
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (pullStartY > 0 && window.scrollY === 0) {
      pullDistance = e.touches[0].clientY - pullStartY;
      if (pullDistance > 0 && pullDistance < PULL_THRESHOLD * 2) {
        pullIndicator.style.transform = `translateY(${Math.min(0, pullDistance - PULL_THRESHOLD)}px)`;
      }
    }
  }, { passive: true });

  document.addEventListener('touchend', () => {
    if (pullDistance >= PULL_THRESHOLD && state.currentWeatherData) {
      // Trigger refresh
      window.triggerWeatherRefresh?.();
    }
    pullStartY = 0;
    pullDistance = 0;
    pullIndicator.style.transform = 'translateY(-100%)';
  }, { passive: true });

  // Force refresh logic: Show a refresh button if loading takes too long
  let loadingTimeout = setTimeout(() => {
    if (state.isInitialLoad) {
      const refreshBtn = document.createElement('button');
      refreshBtn.textContent = "Refresh & Clear Cache";
      refreshBtn.className = "fixed bottom-10 bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-full backdrop-blur-md border border-white/30 z-[60] font-bold transition-all";
      refreshBtn.onclick = () => {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then(registrations => {
            for(let registration of registrations) { registration.unregister(); }
            caches.keys().then(names => {
              for (let name of names) caches.delete(name);
              window.location.reload(true);
            });
          });
        } else {
          window.location.reload(true);
        }
      };
      loadingOverlay.appendChild(refreshBtn);
    }
  }, 8000);

  // Initial fetch with geolocation timeout
  let geoHandled = false;
  function startApp(location) {
    if (geoHandled) return;
    geoHandled = true;
    // 🔗 Navigation: Update URL when location changes
    if (typeof updateLocationUrl === 'function') {
      updateLocationUrl(location);
    }
    fetchWeatherData(location);
  }

  let geoFallback = setTimeout(() => {
    console.log("Geolocation timeout, falling back to default.");
    startApp("Ottawa");
  }, 6000);

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(geoFallback);
        startApp(`${pos.coords.latitude},${pos.coords.longitude}`);
      },
      () => {
        clearTimeout(geoFallback);
        startApp("Ottawa");
      },
      { timeout: 6000 }
    );
  } else {
    clearTimeout(geoFallback);
    startApp("Ottawa");
  }
  // Set initial theme
  const savedTheme = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (savedTheme) setTheme(savedTheme);
  else if (prefersDark) setTheme("dark");

  // 🛡️ Persistence: Load saved unit preference
  const savedUnit = localStorage.getItem('unitGroup');
  if (savedUnit && (savedUnit === 'metric' || savedUnit === 'us')) {
    state.unitGroup = savedUnit;
    // Update button states without refetching
    if (savedUnit === 'us') {
      fahrenheitButton.className =
        "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-md rounded-xl px-3 py-1.5 flex items-center justify-center font-bold text-sm interactive-element";
      celsiusButton.className =
        "px-3 py-1.5 flex items-center justify-center font-bold text-sm text-gray-500 dark:text-gray-400 interactive-element";
    }
  }

  // 🛡️ Accessibility: Listen for system theme changes
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    // Only auto-switch if user hasn't manually set a preference
    if (!localStorage.getItem("theme")) {
      setTheme(e.matches ? "dark" : "light");
    }
  });

  // 🔗 Navigation: Handle deep linking and browser history
  function handleDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const locationParam = params.get('location');
    if (locationParam) {
      fetchWeatherData(decodeURIComponent(locationParam));
    }
  }

  // Update URL with current location for shareable links
  function updateLocationUrl(location) {
    const url = new URL(window.location.href);
    url.searchParams.set('location', encodeURIComponent(location));
    window.history.pushState({}, '', url);
  }

  // Listen for browser back/forward buttons
  window.addEventListener('popstate', () => {
    const params = new URLSearchParams(window.location.search);
    const locationParam = params.get('location');
    if (locationParam) {
      fetchWeatherData(decodeURIComponent(locationParam));
    }
  });

  // Initialize: Check for deep link in URL
  handleDeepLink();

  updateRecentSearchesUI();
});
