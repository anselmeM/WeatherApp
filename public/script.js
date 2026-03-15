import { getWeatherIcon, getWindDirection, formatTime, showError } from './utils.js';
import { drawTempChart } from './chart.js';

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then((reg) => console.log("ServiceWorker registration successful."))
      .catch((err) => console.log("ServiceWorker registration failed: ", err));
  });
}

document.addEventListener("DOMContentLoaded", () => {
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
  const recentSearchesContainer = document.getElementById(
    "recent-searches-container",
  );
  const recentSearchesList = document.getElementById("recent-searches-list");
  const autocompleteDropdown = document.getElementById("search-autocomplete-dropdown");

  let autocompleteTimeout;

  searchInput.addEventListener("input", (e) => {
    clearTimeout(autocompleteTimeout);
    const query = e.target.value.trim();
    if (query.length < 2) {
      autocompleteDropdown.classList.add("hidden");
      return;
    }
    autocompleteTimeout = setTimeout(() => fetchAutocomplete(query), 300);
  });

  document.addEventListener("click", (e) => {
    if (!searchInput.contains(e.target) && !autocompleteDropdown.contains(e.target)) {
      autocompleteDropdown.classList.add("hidden");
    }
  });

  async function fetchAutocomplete(query) {
    try {
      const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`);
      if (!response.ok) return;
      const data = await response.json();
      renderAutocomplete(data.results || []);
    } catch (error) {
      console.error("Autocomplete fetch error: ", error);
    }
  }

  function renderAutocomplete(results) {
    autocompleteDropdown.innerHTML = "";
    if (results.length === 0) {
      autocompleteDropdown.classList.add("hidden");
      return;
    }

    results.forEach(result => {
      const li = document.createElement("li");
      li.className = "px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-sm text-gray-800 dark:text-gray-200 border-b border-gray-100 dark:border-gray-700 last:border-0 truncate flex items-center";
      
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
      
      autocompleteDropdown.appendChild(li);
    });

    autocompleteDropdown.classList.remove("hidden");
  }

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

  function getWindDirection(deg) {
    const directions = [
      "N",
      "NNE",
      "NE",
      "ENE",
      "E",
      "ESE",
      "SE",
      "SSE",
      "S",
      "SSW",
      "SW",
      "WSW",
      "W",
      "WNW",
      "NW",
      "NNW",
    ];
    const index = Math.round((deg % 360) / 22.5);
    return directions[index % 16];
  }

  function formatTime(timeStr) {
    if (!timeStr) return "";
    const [hour, minute] = timeStr.split(":");
    return new Date(2023, 0, 1, hour, minute)
      .toLocaleTimeString("en-US", { hour: "numeric", hour12: true })
      .replace(" ", "");
  }

  function showError(message) {
    const errorBox = document.createElement("div");
    errorBox.textContent = message;
    errorBox.className =
      "fixed top-5 right-5 bg-red-600/90 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl z-50 transition-all duration-500 transform translate-x-[120%]";
    document.body.appendChild(errorBox);
    setTimeout(() => {
      errorBox.classList.remove("translate-x-[120%]");
    }, 50);
    setTimeout(() => {
      errorBox.classList.add("translate-x-[120%]");
      errorBox.addEventListener("transitionend", () => errorBox.remove());
    }, 4000);
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
            if (error.name === 'AbortError') {
                showError("Request timed out. Please try again.");
            } else {
                showError(error.message || "Location not found. Please try again.");
            }
            if (!state.isInitialLoad) hideSkeleton();
        } finally {
            if (state.isInitialLoad) {
                loadingOverlay.style.display = 'none';
                weatherDashboard.classList.remove('hidden');
                weatherDashboard.classList.add('flex');
                state.isInitialLoad = false;
            }
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
      recentSearchesContainer.classList.add("hidden");
      return;
    }
    recentSearchesContainer.classList.remove("hidden");
    recentSearchesList.innerHTML = "";
    state.recentSearches.forEach((city) => {
      const btn = document.createElement("button");
      btn.className =
        "bg-white/30 dark:bg-gray-700/50 hover:bg-white/50 dark:hover:bg-gray-600/50 text-gray-800 dark:text-white text-xs font-bold px-3 py-1.5 rounded-full transition-all interactive-element";
      btn.textContent = city;
      btn.onclick = () => fetchWeatherData(city);
      recentSearchesList.appendChild(btn);
    });
  }

    function drawTempChart(hours, unit) {
        const svg = document.getElementById('temp-chart-svg');
        if (!svg) return;
        const pathLine = svg.querySelector('.temp-line');
        const pathArea = svg.querySelector('.temp-area');
        if (!pathLine || !pathArea) return;
        
        // Use a 12-hour window starting from current hour
        const currentHour = new Date().getHours();
        const displayHours = hours.filter(h => {
            const hHour = parseInt(h.datetime.substring(0, 2));
            return hHour >= currentHour;
        }).slice(0, 12);
        
        if (displayHours.length < 2) return;

        // Use viewBox for responsive scaling instead of clientWidth/Height
        const width = 1000;
        const height = 200;
        const margin = 40;
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        
        const chartWidth = width - margin * 2;
        const chartHeight = height - margin * 2;

        const temps = displayHours.map(h => h.temp);
        const minTemp = Math.min(...temps) - 1;
        const maxTemp = Math.max(...temps) + 1;
        const tempRange = maxTemp - minTemp || 1;

        const points = displayHours.map((h, i) => {
            const x = margin + (i / (displayHours.length - 1)) * chartWidth;
            const y = margin + (1 - (h.temp - minTemp) / tempRange) * chartHeight;
            return { x, y };
        });

        // Line path
        const lineD = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
        pathLine.setAttribute('d', lineD);

        // Area path
        const areaD = `${lineD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;
        pathArea.setAttribute('d', areaD);

        // Add points
        svg.querySelectorAll('.temp-point').forEach(p => p.remove());
        points.forEach((p, i) => {
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute('cx', p.x);
            circle.setAttribute('cy', p.y);
            circle.setAttribute('r', 6);
            circle.setAttribute('class', 'temp-point interactive-element');
            
            // Add title for hover tooltip
            const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
            title.textContent = `${displayHours[i].datetime.substring(0, 5)}: ${displayHours[i].temp}${unit}`;
            circle.appendChild(title);
            
            svg.appendChild(circle);
        });
    }

  function showAlertBanner(alerts) {
    if (!alerts || alerts.length === 0) {
      alertBanner.classList.add('-translate-y-full');
      alertBanner.classList.add('hidden');
      return;
    }
    const alert = alerts[0];
    alertText.textContent = `${alert.event}: ${alert.headline}`;
    alertBanner.classList.remove('hidden');
    setTimeout(() => alertBanner.classList.remove('-translate-y-full'), 100);
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

    if (!state.isInitialLoad) hideSkeleton();
  }

  // ⚡ Bolt: Cache city images to prevent redundant network requests on unit toggle or repeated searches
  const imageCache = new Map();
  // ⚡ Bolt: Prevent memory exhaustion from unbounded image cache growth
  const MAX_IMAGE_CACHE_SIZE = 50;

  async function getCityImage(cityName) {
    if (imageCache.has(cityName)) {
      return imageCache.get(cityName);
    }

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

    // ⚡ Bolt: Simple FIFO eviction policy
    if (imageCache.size >= MAX_IMAGE_CACHE_SIZE) {
      const oldestKey = imageCache.keys().next().value;
      imageCache.delete(oldestKey);
    }

    imageCache.set(cityName, imageUrl);
    return imageUrl;
  }

  function updateCurrentWeather(current, today, tempUnit, data) {
    const mainWeatherIcon = document.getElementById("main-weather-icon");
    mainWeatherIcon.textContent = getWeatherIcon(current.icon);
    mainWeatherIcon.classList.remove("icon-pop");
    void mainWeatherIcon.offsetWidth; // Trigger reflow
    mainWeatherIcon.classList.add("icon-pop");

    document.getElementById("current-temp").textContent =
      `${Math.round(current.temp)}${tempUnit}`;
    document.getElementById("feels-like-temp").textContent =
      `Feels like ${Math.round(current.feelslike)}${tempUnit}`;
    document.getElementById("current-datetime").textContent =
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        hour: "2-digit",
        minute: "2-digit",
      });
    document.getElementById("condition-icon").textContent = getWeatherIcon(
      current.icon,
    );
    document.getElementById("condition-text").textContent = current.conditions;
    document.getElementById("rain-chance").textContent =
      `Rain - ${Math.round(today.precipprob)}%`;
    document.getElementById("location-name").textContent = data.resolvedAddress;

    const cityName = data.address.split(",")[0];
    const locationImage = document.getElementById("location-image");
    
    // Set loading placeholder immediately
    locationImage.src = `https://placehold.co/400x150/1f2937/ffffff?text=Loading...`;
    
    // Fetch actual image asynchronously
    getCityImage(cityName).then(url => {
        locationImage.src = url;
    });
  }


  function updateHourlyForecast(today, tempUnit) {
    const hourlyContainer = document.getElementById(
      "hourly-forecast-container",
    );
    hourlyContainer.innerHTML = "";
    const currentHour = new Date().getHours();
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
        hourlyContainer.appendChild(card);
      });
  }

  function updateWeeklyForecast(data, tempUnit) {
    const forecastGrid = document.getElementById("forecast-grid");
    forecastGrid.innerHTML = "";
    data.days.slice(0, 7).forEach((day, index) => {
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
      forecastGrid.appendChild(card);
    });
  }

  function updateHighlights(today, current, speedUnit, distUnit) {
    const highlightsGrid = document.getElementById("highlights-grid");
    const airQuality = Math.floor(Math.random() * 80) + 20; // Simulated
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
                <p class="text-4xl font-black my-4 text-gray-800 dark:text-white tracking-tighter">${airQuality}</p>
                <p class="text-gray-500 dark:text-gray-400 font-medium mb-2">${airQuality < 50 ? "Good" : "Fair"} air quality.</p>
                <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mt-4 overflow-hidden">
                    <div id="air-quality-bar" class="bg-orange-500 h-2.5 rounded-full progress-bar-animated shadow-sm" style="width: 0%"></div>
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
      document.getElementById("air-quality-bar").style.width =
        `${Math.min(100, (airQuality / 200) * 100)}%`;
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

  function setUnit(unit) {
    if (state.unitGroup === unit) return;
    state.unitGroup = unit;
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
    const currentLocation =
      document.getElementById("location-name").textContent;
    fetchWeatherData(currentLocation);
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
      fetchWeatherData(searchInput.value.trim());
      searchInput.value = "";
    }
  });

  geolocationButton.addEventListener("click", () => {
    if (navigator.geolocation) {
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
          }
        },
        (error) => showError("Could not get your location."),
        { timeout: 5000 } // Add timeout to button click as well
      );
    } else {
      showError("Geolocation is not supported by this browser.");
    }
  });

  closeAlertButton.addEventListener("click", () => {
    alertBanner.classList.add("-translate-y-full");
  });

  themeToggleButton.addEventListener("click", () => {
    const newTheme = document.documentElement.classList.contains("dark")
      ? "light"
      : "dark";
    setTheme(newTheme);
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

  updateRecentSearchesUI();
});
