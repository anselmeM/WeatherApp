import { state, getDisplayTemp } from './js/state.js';
import { drawTempChart } from './chart.js';
import { showError, showToast } from './utils.js';
import {
  getAuth,
  storeAuth,
  clearAuth,
  authFetch,
  updateAuthUI,
  validateSession,
  initAuthCallbacks,
  showPaymentModal,
  downgradeCurrentUser
} from './js/auth.js';
import {
  showSkeleton,
  hideSkeleton,
  toggleForecastView,
  updateRecentSearchesUI,
  updatePinButtonUI,
  updateUI,
  setOnDeleteLocation,
  setOnSelectLocation
} from './js/ui-render.js';
import { pinLocation, deleteSavedLocation } from './js/locations.js';

// Caching local variables
const CONSENT_KEY = 'weather_privacy_consent';

document.addEventListener("DOMContentLoaded", () => {
  // Bind UI Rendering callbacks
  setOnDeleteLocation(deleteSavedLocation);
  setOnSelectLocation(fetchWeatherData);

  // Bind Auth callbacks
  initAuthCallbacks({
    onUpgrade: (user) => {
      showToast('Upgrade successful! Welcome to Premium.', 'success');
      const currentLoc = state.currentWeatherData?.address || document.getElementById("location-name")?.textContent;
      if (currentLoc && currentLoc !== '--') {
        fetchWeatherData(currentLoc);
      } else {
        updateUI();
      }
    },
    onDowngrade: (data) => {
      showToast('Premium subscription cancelled.', 'success');
      // Sync locations from downgrade response
      if (data.locations) {
        state.recentSearches = data.locations;
        localStorage.setItem('recentSearches', JSON.stringify(state.recentSearches));
        updateRecentSearchesUI();
        updatePinButtonUI();
      }
      
      // Immediately enforce free-tier limits on cached data
      if (state.currentWeatherData) {
        state.currentWeatherData.tier = 'free';
        state.currentWeatherData.isLimited = true;
        // Truncate cached days to 3 (free-tier limit)
        if (state.currentWeatherData.days && state.currentWeatherData.days.length > 3) {
          state.currentWeatherData.days = state.currentWeatherData.days.slice(0, 3);
        }
        // Strip alerts (premium-only feature)
        delete state.currentWeatherData.alerts;
        state.currentWeatherData.upgradeMessage = 'Upgrade to Premium to see full 7-day forecast';
      }
      
      const currentLoc = state.currentWeatherData?.address || document.getElementById("location-name")?.textContent;
      if (currentLoc && currentLoc !== '--') {
        fetchWeatherData(currentLoc);
      } else {
        updateUI();
      }
    }
  });

  // DOM Elements for input/control bindings
  const searchInput = document.getElementById("search-input");
  const todayButton = document.getElementById("today-button");
  const weekButton = document.getElementById("week-button");
  const geolocationButton = document.getElementById("geolocation-button");
  const celsiusButton = document.getElementById("celsius-button");
  const fahrenheitButton = document.getElementById("fahrenheit-button");
  const themeToggleButton = document.getElementById("theme-toggle");
  const logoutButton = document.getElementById("logout-button");
  const closeAlertButton = document.getElementById("close-alert-button");
  const loadingOverlay = document.getElementById("loading-overlay");
  const weatherDashboard = document.getElementById("weather-dashboard");
  const locationNameEl = document.getElementById("location-name");
  const clearSearchButton = document.getElementById("clear-search-button");
  const autocompleteDropdown = document.getElementById("search-autocomplete-dropdown");

  // GDPR Consent elements
  let consentBanner = document.getElementById("privacy-consent-banner");

  function handleConsent(granted) {
    if (granted) {
      localStorage.setItem(CONSENT_KEY, 'granted');
      localStorage.setItem(CONSENT_KEY + '_date', new Date().toISOString());
      // Populate state with cached searches if any
      state.recentSearches = JSON.parse(localStorage.getItem("recentSearches") || "[]")
        .filter(c => !c.match(/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/));
      updateRecentSearchesUI();
      updatePinButtonUI();
    } else {
      localStorage.setItem(CONSENT_KEY, 'denied');
      localStorage.removeItem('recentSearches');
      localStorage.removeItem('unitGroup');
      state.recentSearches = [];
      updateRecentSearchesUI();
      updatePinButtonUI();
    }
    if (consentBanner) consentBanner.style.display = 'none';
  }

  if (consentBanner) {
    if (localStorage.getItem(CONSENT_KEY)) {
      consentBanner.style.display = 'none';
    } else {
      consentBanner.style.display = 'flex';
      document.getElementById("accept-consent")?.addEventListener("click", () => handleConsent(true));
      document.getElementById("decline-consent")?.addEventListener("click", () => handleConsent(false));
    }
  }

  // Weather fetcher coordinator
  async function fetchWeatherData(location) {
    if (state.isInitialLoad) {
      if (loadingOverlay) loadingOverlay.style.display = 'flex';
    } else {
      showSkeleton();
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    const apiUrl = `/api/weather?location=${encodeURIComponent(location)}&unitGroup=${state.unitGroup}`;
    try {
      const response = await authFetch(apiUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 401 || (response.status === 403 && errorData.upgradeRequired !== true)) {
          clearAuth();
          updateAuthUI();
        }
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      state.currentWeatherData = await response.json();
      state.fetchedUnitGroup = state.unitGroup; // Record unit group of fetched data
      updateUI();
    } catch (error) {
      console.error("Error fetching weather data:", error);
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
        if (loadingOverlay) loadingOverlay.style.display = 'none';
        if (weatherDashboard) {
          weatherDashboard.classList.remove('hidden');
          weatherDashboard.classList.add('flex');
        }
        state.isInitialLoad = false;
      }
    }
  }

  // Listen for retry event from retry button (L-1)
  document.addEventListener('weather-retry', () => {
    const currentLocation = locationNameEl?.textContent;
    if (currentLocation && currentLocation !== '--') {
      fetchWeatherData(currentLocation);
    }
  });

  // Deep Link Handling
  function updateLocationUrl(location) {
    const cleanLoc = location.split(',')[0].trim();
    const url = new URL(window.location.href);
    url.searchParams.set('location', cleanLoc);
    window.history.pushState({ location: cleanLoc }, '', url.toString());
  }

  function handleDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const locationParam = params.get('location');
    if (locationParam) {
      fetchWeatherData(locationParam);
    } else {
      // Default location is New York if none in URL
      fetchWeatherData("New York");
    }
  }

  // Bind input controls
  celsiusButton?.addEventListener("click", () => {
    if (state.unitGroup === "metric") return;
    state.unitGroup = "metric";
    localStorage.setItem("unitGroup", "metric");
    celsiusButton.classList.add("bg-blue-500", "text-white");
    celsiusButton.setAttribute("aria-pressed", "true");
    fahrenheitButton?.classList.remove("bg-blue-500", "text-white");
    fahrenheitButton?.setAttribute("aria-pressed", "false");
    updateUI();
  });

  fahrenheitButton?.addEventListener("click", () => {
    if (state.unitGroup === "us") return;
    state.unitGroup = "us";
    localStorage.setItem("unitGroup", "us");
    fahrenheitButton.classList.add("bg-blue-500", "text-white");
    fahrenheitButton.setAttribute("aria-pressed", "true");
    celsiusButton?.classList.remove("bg-blue-500", "text-white");
    celsiusButton?.setAttribute("aria-pressed", "false");
    updateUI();
  });

  todayButton?.addEventListener("click", () => toggleForecastView("today"));
  weekButton?.addEventListener("click", () => toggleForecastView("week"));

  // Clear button visibility logic
  searchInput?.addEventListener("input", () => {
    if (searchInput.value.trim().length > 0) {
      clearSearchButton?.classList.remove("hidden");
    } else {
      clearSearchButton?.classList.add("hidden");
      if (autocompleteDropdown) autocompleteDropdown.classList.add("hidden");
    }
  });

  clearSearchButton?.addEventListener("click", () => {
    if (searchInput) {
      searchInput.value = "";
      searchInput.focus();
    }
    clearSearchButton.classList.add("hidden");
    if (autocompleteDropdown) autocompleteDropdown.classList.add("hidden");
  });

  // Autocomplete functionality
  let autocompleteDebounce;
  searchInput?.addEventListener("input", (e) => {
    clearTimeout(autocompleteDebounce);
    const query = e.target.value.trim();
    if (query.length < 2) {
      if (autocompleteDropdown) autocompleteDropdown.classList.add("hidden");
      return;
    }
    
    autocompleteDebounce = setTimeout(() => {
      const suggestions = [
        `${query}, United States`,
        `${query}, United Kingdom`,
        `${query}, Canada`,
        `${query}, Australia`,
        `${query}, Germany`
      ];
      renderAutocomplete(suggestions);
    }, 300);
  });

  function renderAutocomplete(suggestions) {
    if (!autocompleteDropdown) return;
    autocompleteDropdown.innerHTML = "";
    if (suggestions.length === 0) {
      autocompleteDropdown.classList.add("hidden");
      return;
    }
    
    suggestions.forEach(loc => {
      const li = document.createElement("li");
      li.className = "px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-sm text-gray-700 dark:text-gray-200 transition-colors border-b border-gray-100 dark:border-gray-700/50 last:border-0";
      li.textContent = loc;
      li.onclick = () => {
        if (searchInput) searchInput.value = "";
        clearSearchButton?.classList.add("hidden");
        autocompleteDropdown.classList.add("hidden");
        updateLocationUrl(loc);
        fetchWeatherData(loc);
      };
      autocompleteDropdown.appendChild(li);
    });
    autocompleteDropdown.classList.remove("hidden");
  }

  // Close dropdown on click outside
  document.addEventListener("click", (e) => {
    if (autocompleteDropdown && !autocompleteDropdown.contains(e.target) && e.target !== searchInput) {
      autocompleteDropdown.classList.add("hidden");
    }
  });

  searchInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && searchInput.value.trim()) {
      const location = searchInput.value.trim();
      const firstSug = autocompleteDropdown?.querySelector("li")?.textContent;
      if (firstSug && autocompleteDropdown && !autocompleteDropdown.classList.contains("hidden")) {
        // Auto-select first autocomplete option
        searchInput.value = "";
        clearSearchButton?.classList.add("hidden");
        autocompleteDropdown.classList.add("hidden");
        updateLocationUrl(firstSug);
        fetchWeatherData(firstSug);
      } else {
        updateLocationUrl(location);
        fetchWeatherData(location);
        searchInput.value = "";
        clearSearchButton?.classList.add("hidden");
      }
    } else if (e.key === "Enter" && !searchInput.value.trim()) {
      showError("Please enter a city name to search.");
    }
  });

  geolocationButton?.addEventListener("click", () => {
    if (navigator.geolocation) {
      const originalIcon = geolocationButton.querySelector('.material-icons')?.textContent || 'my_location';
      const iconSpan = geolocationButton.querySelector('.material-icons');
      if (iconSpan) iconSpan.textContent = 'hourglass_empty';
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
            if (iconSpan) iconSpan.textContent = originalIcon;
            geolocationButton.disabled = false;
            geolocationButton.classList.remove('opacity-50', 'cursor-not-allowed');
          }
        },
        (error) => {
          showError("Could not get your location. Please search manually.");
          if (iconSpan) iconSpan.textContent = originalIcon;
          geolocationButton.disabled = false;
          geolocationButton.classList.remove('opacity-50', 'cursor-not-allowed');
        },
        { timeout: 5000 }
      );
    } else {
      showError("Geolocation is not supported by this browser.");
    }
  });

  closeAlertButton?.addEventListener("click", () => {
    const alertBanner = document.getElementById("weather-alert-banner");
    alertBanner?.classList.add("-translate-y-full");
  });

  // Dark/Light Theme Switching
  themeToggleButton?.addEventListener("click", () => {
    const html = document.documentElement;
    const isDark = html.classList.toggle("dark");
    localStorage.setItem("theme", isDark ? "dark" : "light");
    
    const iconSpan = themeToggleButton.querySelector('.material-icons');
    if (iconSpan) {
      iconSpan.textContent = isDark ? "light_mode" : "dark_mode";
    }
  });

  // Initial Theme load
  const cachedTheme = localStorage.getItem("theme");
  const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (cachedTheme === "dark" || (!cachedTheme && systemPrefersDark)) {
    document.documentElement.classList.add("dark");
    const iconSpan = themeToggleButton?.querySelector('.material-icons');
    if (iconSpan) iconSpan.textContent = "light_mode";
  } else {
    document.documentElement.classList.remove("dark");
    const iconSpan = themeToggleButton?.querySelector('.material-icons');
    if (iconSpan) iconSpan.textContent = "dark_mode";
  }

  // Logout listener
  logoutButton?.addEventListener('click', async () => {
    if (logoutButton) {
      logoutButton.disabled = true;
      const iconSpan = logoutButton.querySelector('.material-icons');
      if (iconSpan) iconSpan.textContent = 'hourglass_empty';
      logoutButton.classList.add('opacity-50', 'cursor-not-allowed');
    }
    
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
    } catch (error) {
      console.warn('Server logout failed:', error);
    } finally {
      clearAuth();
      localStorage.removeItem('recentSearches');
      localStorage.removeItem('unitGroup');
      localStorage.removeItem('theme');
      localStorage.removeItem('weather_onboarding_complete');
      localStorage.removeItem(CONSENT_KEY);
      sessionStorage.clear();
      
      const cookies = document.cookie.split(';');
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i];
        const eqIdx = cookie.indexOf('=');
        const name = eqIdx > -1 ? cookie.substring(0, eqIdx).trim() : cookie.trim();
        document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/';
      }
      
      window.location.href = '/landing.html';
    }
  });

  // Listen for browser back/forward buttons
  window.addEventListener('popstate', () => {
    const params = new URLSearchParams(window.location.search);
    const locationParam = params.get('location');
    if (locationParam) {
      fetchWeatherData(locationParam);
    }
  });

  // In-App Upgrade and Downgrade trigger binds
  document.getElementById('signin-button')?.addEventListener('click', () => {
    window.location.href = '/landing.html';
  });
  
  document.getElementById('inline-upgrade-btn')?.addEventListener('click', showPaymentModal);
  document.getElementById('inline-downgrade-btn')?.addEventListener('click', () => downgradeCurrentUser(msg => showError(msg, 'generic')));

  // Initialize: Check for deep link in URL
  handleDeepLink();
  
  // Set initial unit UI button styling
  if (state.unitGroup === "metric") {
    celsiusButton?.classList.add("bg-blue-500", "text-white");
    celsiusButton?.setAttribute("aria-pressed", "true");
    fahrenheitButton?.classList.remove("bg-blue-500", "text-white");
    fahrenheitButton?.setAttribute("aria-pressed", "false");
  } else {
    fahrenheitButton?.classList.add("bg-blue-500", "text-white");
    fahrenheitButton?.setAttribute("aria-pressed", "true");
    celsiusButton?.classList.remove("bg-blue-500", "text-white");
    celsiusButton?.setAttribute("aria-pressed", "false");
  }

  updateRecentSearchesUI();
  updateAuthUI();

  // Validate session on load
  validateSession((locations) => {
    state.recentSearches = locations;
    localStorage.setItem('recentSearches', JSON.stringify(state.recentSearches));
    updateRecentSearchesUI();
    updatePinButtonUI();
  }, msg => showError(msg, 'generic'));
});
