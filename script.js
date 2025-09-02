if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js').then(reg => console.log('ServiceWorker registration successful.')).catch(err => console.log('ServiceWorker registration failed: ', err));
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // --- Constants ---
    const UNITS = {
        METRIC: 'metric',
        US: 'us',
    };
    const THEMES = {
        LIGHT: 'light',
        DARK: 'dark',
    };

    // --- State ---
    let unitGroup = UNITS.METRIC;
    let currentWeatherData = null;
    let isInitialLoad = true;

    // --- DOM Elements ---
    const loadingOverlay = document.getElementById('loading-overlay');
    const weatherDashboard = document.getElementById('weather-dashboard');
    const searchInput = document.getElementById('search-input');
    const todayButton = document.getElementById('today-button');
    const weekButton = document.getElementById('week-button');
    const hourlySection = document.getElementById('hourly-forecast-section');
    const weeklySection = document.getElementById('weekly-forecast-section');
    const geolocationButton = document.getElementById('geolocation-button');
    const celsiusButton = document.getElementById('celsius-button');
    const fahrenheitButton = document.getElementById('fahrenheit-button');
    const leftPanelContent = document.getElementById('left-panel-content');
    const leftPanelSkeleton = document.getElementById('left-panel-skeleton');
    const rightPanelContent = document.getElementById('right-panel-content');
    const rightPanelSkeleton = document.getElementById('right-panel-skeleton');
    const alertBanner = document.getElementById('weather-alert-banner');
    const alertText = document.getElementById('weather-alert-text');
    const closeAlertButton = document.getElementById('close-alert-button');
    const themeToggleButton = document.getElementById('theme-toggle');

    // --- API Functions ---
    async function fetchWeatherData(location) {
        if (isInitialLoad) {
            loadingOverlay.style.display = 'flex';
        } else {
            showSkeleton();
        }
        const apiUrl = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${location}?unitGroup=${unitGroup}&key=${API_KEY}&contentType=json&include=hours,alerts`;
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('City not found. Please try again.');
                } else {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
            }
            currentWeatherData = await response.json();
            updateUI();
        } catch (error) {
            console.error("Error fetching weather data:", error);
            showError(error.message || "An error occurred while fetching weather data.");
            if (!isInitialLoad) hideSkeleton();
        } finally {
            if (isInitialLoad) {
                loadingOverlay.style.display = 'none';
                weatherDashboard.classList.remove('hidden');
                weatherDashboard.classList.add('flex');
                isInitialLoad = false;
            }
        }
    }

    // --- UI Functions ---
    function updateUI() {
        if (!currentWeatherData || !currentWeatherData.days || currentWeatherData.days.length === 0) {
             if (!isInitialLoad) hideSkeleton();
            return;
        }
        const data = currentWeatherData;
        const today = data.days[0];
        const current = data.currentConditions || today.hours[0];
        const tempUnit = unitGroup === UNITS.METRIC ? '°C' : '°F';
        const speedUnit = unitGroup === UNITS.METRIC ? 'km/h' : 'mph';
        const distUnit = unitGroup === UNITS.METRIC ? 'km' : 'miles';

        if (data.alerts && data.alerts.length > 0) {
            alertText.textContent = data.alerts[0].event;
            alertBanner.classList.remove('hidden');
            setTimeout(() => alertBanner.classList.remove('-translate-y-full'), 10);
        } else {
            alertBanner.classList.add('-translate-y-full');
            setTimeout(() => alertBanner.classList.add('hidden'), 300);
        }

        const mainWeatherIcon = document.getElementById('main-weather-icon');
        mainWeatherIcon.textContent = getWeatherIcon(current.icon);
        mainWeatherIcon.classList.add('icon-pop');
        mainWeatherIcon.addEventListener('animationend', () => mainWeatherIcon.classList.remove('icon-pop'));

        document.getElementById('current-temp').textContent = `${Math.round(current.temp)}${tempUnit}`;
        document.getElementById('feels-like-temp').textContent = `Feels like ${Math.round(current.feelslike)}${tempUnit}`;
        document.getElementById('current-datetime').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', hour: '2-digit', minute: '2-digit' });
        document.getElementById('condition-icon').textContent = getWeatherIcon(current.icon);
        document.getElementById('condition-text').textContent = current.conditions;
        document.getElementById('rain-chance').textContent = `Rain - ${Math.round(today.precipprob)}%`;
        document.getElementById('location-name').textContent = data.resolvedAddress;
        document.getElementById('location-image').src = `https://placehold.co/300x100/a7a7a7/ffffff?text=${data.address.split(',')[0]}`;

        const hourlyContainer = document.getElementById('hourly-forecast-container');
        hourlyContainer.innerHTML = '';
        const currentHour = new Date().getHours();
        today.hours.filter(h => parseInt(h.datetime.substring(0, 2)) >= currentHour).forEach((h, index) => {
            const card = document.createElement('div');
            card.className = "bg-white dark:bg-gray-800 rounded-2xl p-4 text-center flex-shrink-0 interactive-element fade-in-stagger";
            card.style.animationDelay = `${index * 0.05}s`;
            card.innerHTML = `<p class="font-semibold text-gray-600 dark:text-gray-300">${formatTime(h.datetime)}</p><span class="material-icons text-gray-700 dark:text-gray-200 text-3xl my-2">${getWeatherIcon(h.icon)}</span><p class="text-lg font-bold text-gray-800 dark:text-white">${Math.round(h.temp)}°</p>`;
            hourlyContainer.appendChild(card);
        });

        const forecastGrid = document.getElementById('forecast-grid');
        forecastGrid.innerHTML = '';
        data.days.slice(0, 7).forEach((day, index) => {
            const card = document.createElement('div');
            card.className = "bg-white dark:bg-gray-800 rounded-2xl p-4 text-center interactive-element fade-in-stagger";
            card.style.animationDelay = `${index * 0.05}s`;
            card.innerHTML = `<p class="font-semibold text-gray-600 dark:text-gray-300">${new Date(day.datetime).toLocaleDateString('en-US', { weekday: 'short' })}</p><span class="material-icons text-yellow-400 text-3xl my-2">${getWeatherIcon(day.icon)}</span><p class="text-sm text-gray-800 dark:text-white"><span class="font-bold">${Math.round(day.tempmax)}°</span> <span class="text-gray-400">${Math.round(day.tempmin)}°</span></p>`;
            forecastGrid.appendChild(card);
        });

        const highlightsGrid = document.getElementById('highlights-grid');
        const airQuality = Math.floor(Math.random() * 150) + 50;
        highlightsGrid.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 interactive-element"><p class="text-gray-500 dark:text-gray-400">UV Index</p><div class="relative h-24 w-24 mx-auto my-2"><svg class="w-full h-full" viewBox="0 0 36 36"><path class="text-gray-200 dark:text-gray-700" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="3"></path><path id="uv-progress" class="text-yellow-500 progress-bar-animated" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831" fill="none" stroke="currentColor" stroke-dasharray="0, 100" stroke-linecap="round" stroke-width="3"></path></svg><div class="absolute inset-0 flex items-center justify-center"><span class="text-3xl font-bold text-gray-800 dark:text-white">${today.uvindex}</span></div></div></div>
            <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 interactive-element"><p class="text-gray-500 dark:text-gray-400">Wind Status</p><p class="text-3xl sm:text-4xl font-bold my-4 text-gray-800 dark:text-white"><span>${current.windspeed}</span> <span class="text-xl">${speedUnit}</span></p><div class="flex items-center text-gray-600 dark:text-gray-300"><span class="material-icons" style="transform: rotate(${current.winddir}deg)">navigation</span><p class="ml-2">${getWindDirection(current.winddir)}</p></div></div>
            <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 interactive-element"><p class="text-gray-500 dark:text-gray-400">Sunrise & Sunset</p><div class="flex items-center my-3"><span class="material-icons text-yellow-500 mr-3 text-2xl">arrow_upward</span><div class="text-gray-800 dark:text-white"><p class="font-bold">${formatTime(today.sunrise)}</p></div></div><div class="flex items-center"><span class="material-icons text-yellow-500 mr-3 text-2xl">arrow_downward</span><div class="text-gray-800 dark:text-white"><p class="font-bold">${formatTime(today.sunset)}</p></div></div></div>
            <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 interactive-element"><p class="text-gray-500 dark:text-gray-400">Humidity</p><p class="text-3xl sm:text-4xl font-bold my-4 text-gray-800 dark:text-white"><span>${Math.round(current.humidity)}</span> <span class="text-xl">%</span></p><div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-2 overflow-hidden"><div id="humidity-bar" class="bg-blue-600 dark:bg-blue-400 h-1.5 rounded-full progress-bar-animated" style="width: 0%"></div></div></div>
            <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 interactive-element"><p class="text-gray-500 dark:text-gray-400">Visibility</p><p class="text-3xl sm:text-4xl font-bold my-4 text-gray-800 dark:text-white"><span>${current.visibility}</span> <span class="text-xl">${distUnit}</span></p><div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-2 overflow-hidden"><div id="visibility-bar" class="bg-green-500 dark:bg-green-400 h-1.5 rounded-full progress-bar-animated" style="width: 0%"></div></div></div>
            <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 interactive-element"><p class="text-gray-500 dark:text-gray-400">Air Quality</p><p class="text-3xl sm:text-4xl font-bold my-4 text-gray-800 dark:text-white">${airQuality}</p><div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-2 overflow-hidden"><div id="air-quality-bar" class="bg-orange-500 dark:bg-orange-400 h-1.5 rounded-full progress-bar-animated" style="width: 0%"></div></div></div>
        `;
        
        setTimeout(() => {
            document.getElementById('uv-progress').style.strokeDasharray = `${(today.uvindex / 10) * (2 * Math.PI * 15.9155)}, 100`;
            document.getElementById('humidity-bar').style.width = `${current.humidity}%`;
            document.getElementById('visibility-bar').style.width = `${(current.visibility / 16) * 100}%`;
            document.getElementById('air-quality-bar').style.width = `${(airQuality / 200) * 100}%`;
        }, 100);

        if (!isInitialLoad) hideSkeleton();
    }

    function showSkeleton() {
        leftPanelContent.classList.add('hidden');
        rightPanelContent.classList.add('hidden');
        leftPanelSkeleton.classList.remove('hidden');
        rightPanelSkeleton.classList.remove('hidden');
    }

    function hideSkeleton() {
        leftPanelContent.classList.remove('hidden');
        rightPanelContent.classList.remove('hidden');
        leftPanelSkeleton.classList.add('hidden');
        rightPanelSkeleton.classList.add('hidden');
    }

    function showError(message) {
        const errorBox = document.createElement('div');
        errorBox.textContent = message;
        errorBox.className = "fixed top-5 right-5 bg-red-500 text-white p-4 rounded-lg shadow-lg z-50 transition-transform duration-300 transform translate-x-full";
        document.body.appendChild(errorBox);
        setTimeout(() => { errorBox.classList.remove('translate-x-full'); }, 10);
        setTimeout(() => { errorBox.classList.add('translate-x-full'); errorBox.addEventListener('transitionend', () => errorBox.remove()); }, 4000);
    }

    function toggleForecastView(view) {
        if (view === 'today') {
            hourlySection.classList.remove('view-hidden');
            weeklySection.classList.add('view-hidden');
            todayButton.className = 'text-gray-900 dark:text-white font-bold border-b-2 border-gray-900 dark:border-white pb-1 interactive-element';
            weekButton.className = 'text-gray-500 dark:text-gray-400 font-semibold interactive-element';
        } else {
            hourlySection.classList.add('view-hidden');
            weeklySection.classList.remove('view-hidden');
            weekButton.className = 'text-gray-900 dark:text-white font-bold border-b-2 border-gray-900 dark:border-white pb-1 interactive-element';
            todayButton.className = 'text-gray-500 dark:text-gray-400 font-semibold interactive-element';
        }
    }

    function setUnit(unit) {
        if (unitGroup === unit) return;
        unitGroup = unit;
        if (unit === UNITS.METRIC) {
            celsiusButton.className = 'bg-white text-black rounded-full w-6 h-6 flex items-center justify-center font-bold text-xs interactive-element';
            fahrenheitButton.className = 'w-6 h-6 flex items-center justify-center font-bold text-xs interactive-element';
        } else {
            fahrenheitButton.className = 'bg-white text-black rounded-full w-6 h-6 flex items-center justify-center font-bold text-xs interactive-element';
            celsiusButton.className = 'w-6 h-6 flex items-center justify-center font-bold text-xs interactive-element';
        }
        const currentLocation = document.getElementById('location-name').textContent;
        fetchWeatherData(currentLocation);
    }

    function setTheme(theme) {
        localStorage.setItem('theme', theme);
        if (theme === THEMES.DARK) {
            document.documentElement.classList.add(THEMES.DARK);
            themeToggleButton.querySelector('.material-icons').textContent = 'dark_mode';
        } else {
            document.documentElement.classList.remove(THEMES.DARK);
            themeToggleButton.querySelector('.material-icons').textContent = 'light_mode';
        }
    }

    // --- Utility Functions ---
    function getWeatherIcon(condition) {
        const iconMap = { 'partly-cloudy-day': 'cloud', 'partly-cloudy-night': 'cloud', 'cloudy': 'cloud', 'clear-day': 'wb_sunny', 'clear-night': 'nightlight_round', 'rain': 'grain', 'snow': 'ac_unit', 'sleet': 'ac_unit', 'wind': 'air', 'fog': 'foggy', 'thunderstorm': 'thunderstorm' };
        return iconMap[condition] || 'cloud';
    }

    function getWindDirection(deg) {
        const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
        const index = Math.round((deg % 360) / 22.5);
        return directions[index % 16];
    }

    function formatTime(timeStr) {
        const [hour, minute] = timeStr.split(':');
        const date = new Date();
        date.setHours(hour, minute);
        return date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }).replace(' ', '');
    }

    // --- Event Listeners ---
    function addEventListeners() {
        todayButton.addEventListener('click', () => toggleForecastView('today'));
        weekButton.addEventListener('click', () => toggleForecastView('week'));
        celsiusButton.addEventListener('click', () => setUnit(UNITS.METRIC));
        fahrenheitButton.addEventListener('click', () => setUnit(UNITS.US));
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && searchInput.value.trim()) {
                fetchWeatherData(searchInput.value.trim());
            }
        });
        geolocationButton.addEventListener('click', () => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    position => fetchWeatherData(`${position.coords.latitude},${position.coords.longitude}`),
                    error => showError("Could not get your location.")
                );
            } else {
                showError("Geolocation is not supported by this browser.");
            }
        });
        closeAlertButton.addEventListener('click', () => {
            alertBanner.classList.add('-translate-y-full');
        });
        themeToggleButton.addEventListener('click', () => {
            const newTheme = document.documentElement.classList.contains(THEMES.DARK) ? THEMES.LIGHT : THEMES.DARK;
            setTheme(newTheme);
        });
    }

    // --- Initialization ---
    function initialize() {
        addEventListeners();
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (savedTheme) {
            setTheme(savedTheme);
        } else if (prefersDark) {
            setTheme(THEMES.DARK);
        }
        fetchWeatherData('Ottawa, Canada');
    }

    initialize();
});
