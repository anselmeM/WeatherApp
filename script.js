/**
 * =================================================================================
 * ❗ CRITICAL SECURITY WARNING ❗
 * =================================================================================
 * NEVER expose your API key in client-side code like this in a real application.
 * It can be stolen and used by others, leading to high costs or service suspension.
 *
 * SOLUTION: Create a server-side proxy (e.g., using Node.js, Netlify Functions, etc.)
 * that securely stores the API key and makes requests to the weather API on behalf
 * of your front-end.
 * =================================================================================
 */

// The API_KEY is now expected to be loaded from `config.js`

// Register Service Worker for PWA capabilities
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(reg => console.log('ServiceWorker registration successful.'))
            .catch(err => console.log('ServiceWorker registration failed: ', err));
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // --- Constants ---
    const constants = {
        API_BASE_URL: 'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline',
        MAX_UV_INDEX: 10,
        MAX_VISIBILITY_KM: 16, // Typical max visibility range
        MAX_AQI: 300,          // Air Quality Index scale
        CLASSES: {
            HIDDEN: 'hidden',
            VIEW_HIDDEN: 'view-hidden',
            ACTIVE_BUTTON_PRIMARY: 'text-gray-900 dark:text-white font-bold border-b-2 border-gray-900 dark:border-white pb-1 interactive-element',
            INACTIVE_BUTTON_PRIMARY: 'text-gray-500 dark:text-gray-400 font-semibold interactive-element',
            ACTIVE_BUTTON_SECONDARY: 'bg-white text-black rounded-full w-6 h-6 flex items-center justify-center font-bold text-xs interactive-element',
            INACTIVE_BUTTON_SECONDARY: 'w-6 h-6 flex items-center justify-center font-bold text-xs interactive-element',
        }
    };

    // --- State Management ---
    let unitGroup = 'metric';
    let currentWeatherData = null;
    let isInitialLoad = true;

    // --- DOM Element Cache ---
    const elements = {
        loadingOverlay: document.getElementById('loading-overlay'),
        weatherDashboard: document.getElementById('weather-dashboard'),
        searchInput: document.getElementById('search-input'),
        todayButton: document.getElementById('today-button'),
        weekButton: document.getElementById('week-button'),
        hourlySection: document.getElementById('hourly-forecast-section'),
        weeklySection: document.getElementById('weekly-forecast-section'),
        geolocationButton: document.getElementById('geolocation-button'),
        celsiusButton: document.getElementById('celsius-button'),
        fahrenheitButton: document.getElementById('fahrenheit-button'),
        leftPanelContent: document.getElementById('left-panel-content'),
        leftPanelSkeleton: document.getElementById('left-panel-skeleton'),
        rightPanelContent: document.getElementById('right-panel-content'),
        rightPanelSkeleton: document.getElementById('right-panel-skeleton'),
        alertBanner: document.getElementById('weather-alert-banner'),
        alertText: document.getElementById('weather-alert-text'),
        closeAlertButton: document.getElementById('close-alert-button'),
        themeToggleButton: document.getElementById('theme-toggle'),
        hourlyContainer: document.getElementById('hourly-forecast-container'),
        forecastGrid: document.getElementById('forecast-grid'),
        highlightsGrid: document.getElementById('highlights-grid'),
        locationName: document.getElementById('location-name'),
    };

    // --- Helper Functions ---

    /** Maps API weather conditions to Material Icon names. */
    function getWeatherIcon(condition) {
        const iconMap = {
            'partly-cloudy-day': 'cloud', 'partly-cloudy-night': 'cloud',
            'cloudy': 'cloud', 'clear-day': 'wb_sunny', 'clear-night': 'nightlight_round',
            'rain': 'grain', 'snow': 'ac_unit', 'sleet': 'ac_unit', 'wind': 'air',
            'fog': 'foggy', 'thunderstorm': 'thunderstorm'
        };
        return iconMap[condition] || 'cloud'; // Default icon
    }

    /** Converts wind direction in degrees to a cardinal direction string. */
    function getWindDirection(deg) {
        const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
        const index = Math.round((deg % 360) / 22.5);
        return directions[index % 16];
    }

    /** Formats a "HH:MM:SS" string into a locale-friendly 12-hour format (e.g., "5PM"). */
    function formatTime(timeStr) {
        const [hour, minute] = timeStr.split(':');
        const date = new Date();
        date.setHours(parseInt(hour), parseInt(minute));
        return new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: true }).format(date).replace(' ', '');
    }

    /** Displays a toast-like error message. */
    function showError(message) {
        const errorBox = document.createElement('div');
        errorBox.textContent = message;
        errorBox.className = "fixed top-5 right-5 bg-red-500 text-white p-4 rounded-lg shadow-lg z-50 transition-transform duration-300 transform translate-x-full";
        document.body.appendChild(errorBox);
        setTimeout(() => errorBox.classList.remove('translate-x-full'), 10);
        setTimeout(() => {
            errorBox.classList.add('translate-x-full');
            errorBox.addEventListener('transitionend', () => errorBox.remove());
        }, 5000);
    }

    /** Manages the visibility of skeleton loaders. */
    function toggleSkeleton(show) {
        const action = show ? 'add' : 'remove';
        elements.leftPanelContent.classList[action](constants.CLASSES.HIDDEN);
        elements.rightPanelContent.classList[action](constants.CLASSES.HIDDEN);
        elements.leftPanelSkeleton.classList[show ? 'remove' : 'add'](constants.CLASSES.HIDDEN);
        elements.rightPanelSkeleton.classList[show ? 'remove' : 'add'](constants.CLASSES.HIDDEN);
    }

    /** Sets the active and inactive styles for a group of buttons. */
    function updateButtonStyles(activeBtn, inactiveBtns, activeClass, inactiveClass) {
        activeBtn.className = activeClass;
        inactiveBtns.forEach(btn => btn.className = inactiveClass);
    }

    // --- Core Application Logic ---

    /** Fetches weather data from the API and triggers UI update. */
    async function fetchWeatherData(location) {
        isInitialLoad ? (elements.loadingOverlay.style.display = 'flex') : toggleSkeleton(true);

        const apiUrl = `${constants.API_BASE_URL}/${encodeURIComponent(location)}?unitGroup=${unitGroup}&key=${API_KEY}&contentType=json&include=hours,alerts`;

        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                const error = new Error(`HTTP error! Status: ${response.status}`);
                error.status = response.status;
                throw error;
            }
            currentWeatherData = await response.json();
            updateUI();
        } catch (error) {
            console.error("Error fetching weather data:", error);
            handleFetchError(error);
            if (!isInitialLoad) toggleSkeleton(false);
        } finally {
            if (isInitialLoad) {
                elements.loadingOverlay.style.display = 'none';
                elements.weatherDashboard.classList.remove(constants.CLASSES.HIDDEN);
                elements.weatherDashboard.classList.add('flex');
                isInitialLoad = false;
            }
        }
    }

    /** Handles different types of fetch errors and shows appropriate messages. */
    function handleFetchError(error) {
        if (error instanceof TypeError && error.message === 'Failed to fetch') {
            showError("Network error. Please check your connection.");
        } else if (error.status) {
            const statusMessages = {
                400: "City not found. Please enter a valid city name.",
                404: "City not found. Please enter a valid city name.",
                401: "Invalid API Key. Please check configuration."
            };
            showError(statusMessages[error.status] || "An unexpected error occurred. Please try again later.");
        } else {
            showError("An unexpected error occurred. Please try again.");
        }
    }

    // --- UI Update Functions ---

    /** Main function to orchestrate all UI updates. */
    function updateUI() {
        if (!currentWeatherData || !currentWeatherData.days || currentWeatherData.days.length === 0) {
            if (!isInitialLoad) toggleSkeleton(false);
            showError("Could not retrieve weather data for the location.");
            return;
        }
        const data = currentWeatherData;
        _updateAlerts(data.alerts);
        _updateMainPanel(data);
        _updateHourlyForecast(data.days[0].hours);
        _updateWeeklyForecast(data.days);
        _updateHighlights(data);
        toggleSkeleton(false);
    }

    /** Updates the weather alert banner. */
    function _updateAlerts(alerts) {
        if (alerts && alerts.length > 0) {
            elements.alertText.textContent = alerts[0].event;
            elements.alertBanner.classList.remove(constants.CLASSES.HIDDEN);
            setTimeout(() => elements.alertBanner.classList.remove('-translate-y-full'), 10);
        } else {
            elements.alertBanner.classList.add('-translate-y-full');
            setTimeout(() => elements.alertBanner.classList.add(constants.CLASSES.HIDDEN), 300);
        }
    }

    /** Updates the main panel with current weather conditions. */
    function _updateMainPanel(data) {
        const today = data.days[0];
        const current = data.currentConditions || today.hours[0];
        const tempUnit = unitGroup === 'metric' ? '°C' : '°F';
        const cityName = data.address.split(',')[0];

        const mainWeatherIcon = document.getElementById('main-weather-icon');
        mainWeatherIcon.textContent = getWeatherIcon(current.icon);
        mainWeatherIcon.classList.add('icon-pop');
        mainWeatherIcon.addEventListener('animationend', () => mainWeatherIcon.classList.remove('icon-pop'), { once: true });

        document.getElementById('current-temp').textContent = `${Math.round(current.temp)}${tempUnit}`;
        document.getElementById('feels-like-temp').textContent = `Feels like ${Math.round(current.feelslike)}${tempUnit}`;
        document.getElementById('current-datetime').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', hour: '2-digit', minute: '2-digit' });
        document.getElementById('condition-icon').textContent = getWeatherIcon(current.icon);
        document.getElementById('condition-text').textContent = current.conditions;
        document.getElementById('rain-chance').textContent = `Rain - ${Math.round(today.precipprob)}%`;
        elements.locationName.textContent = data.resolvedAddress;

        // Use a more dynamic placeholder or a dedicated Place Image API
        document.getElementById('location-image').src = `https://source.unsplash.com/300x100/?${cityName}`;
    }

    /** Populates the hourly forecast section. */
    function _updateHourlyForecast(hours) {
        elements.hourlyContainer.innerHTML = '';
        const currentHour = new Date().getHours();
        hours.filter(h => parseInt(h.datetime.substring(0, 2)) >= currentHour)
             .forEach((h, index) => {
                const card = document.createElement('div');
                card.className = "bg-white dark:bg-gray-800 rounded-2xl p-4 text-center flex-shrink-0 interactive-element fade-in-stagger";
                card.style.animationDelay = `${index * 0.05}s`;
                card.innerHTML = `
                    <p class="font-semibold text-gray-600 dark:text-gray-300">${formatTime(h.datetime)}</p>
                    <span class="material-icons text-gray-700 dark:text-gray-200 text-3xl my-2">${getWeatherIcon(h.icon)}</span>
                    <p class="text-lg font-bold text-gray-800 dark:text-white">${Math.round(h.temp)}°</p>`;
                elements.hourlyContainer.appendChild(card);
             });
    }

    /** Populates the weekly forecast section. */
    function _updateWeeklyForecast(days) {
        elements.forecastGrid.innerHTML = '';
        days.slice(0, 7).forEach((day, index) => {
            const card = document.createElement('div');
            card.className = "bg-white dark:bg-gray-800 rounded-2xl p-4 text-center interactive-element fade-in-stagger";
            card.style.animationDelay = `${index * 0.05}s`;
            card.innerHTML = `
                <p class="font-semibold text-gray-600 dark:text-gray-300">${new Date(day.datetime).toLocaleDateString('en-US', { weekday: 'short' })}</p>
                <span class="material-icons text-yellow-400 text-3xl my-2">${getWeatherIcon(day.icon)}</span>
                <p class="text-sm text-gray-800 dark:text-white">
                    <span class="font-bold">${Math.round(day.tempmax)}°</span>
                    <span class="text-gray-400">${Math.round(day.tempmin)}°</span>
                </p>`;
            elements.forecastGrid.appendChild(card);
        });
    }

    /** Populates the "Today's Highlights" grid. */
    function _updateHighlights(data) {
        const today = data.days[0];
        const current = data.currentConditions || today.hours[0];
        const speedUnit = unitGroup === 'metric' ? 'km/h' : 'mph';
        const distUnit = unitGroup === 'metric' ? 'km' : 'miles';

        // Placeholder for Air Quality. In a real app, use API data if available.
        // This makes it seem less random by tying it to cloud cover.
        const airQuality = Math.round(50 + (current.cloudcover || 50));

        elements.highlightsGrid.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 interactive-element"><p class="text-gray-500 dark:text-gray-400">UV Index</p><div class="relative h-24 w-24 mx-auto my-2"><svg class="w-full h-full" viewBox="0 0 36 36"><path class="text-gray-200 dark:text-gray-700" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="3"></path><path id="uv-progress" class="text-yellow-500 progress-bar-animated" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831" fill="none" stroke="currentColor" stroke-dasharray="0, 100" stroke-linecap="round" stroke-width="3"></path></svg><div class="absolute inset-0 flex items-center justify-center"><span class="text-3xl font-bold text-gray-800 dark:text-white">${today.uvindex}</span></div></div></div>
            <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 interactive-element"><p class="text-gray-500 dark:text-gray-400">Wind Status</p><p class="text-3xl sm:text-4xl font-bold my-4 text-gray-800 dark:text-white"><span>${current.windspeed}</span> <span class="text-xl">${speedUnit}</span></p><div class="flex items-center text-gray-600 dark:text-gray-300"><span class="material-icons" style="transform: rotate(${current.winddir}deg)">navigation</span><p class="ml-2">${getWindDirection(current.winddir)}</p></div></div>
            <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 interactive-element"><p class="text-gray-500 dark:text-gray-400">Sunrise & Sunset</p><div class="flex items-center my-3"><span class="material-icons text-yellow-500 mr-3 text-2xl">arrow_upward</span><div class="text-gray-800 dark:text-white"><p class="font-bold">${formatTime(today.sunrise)}</p></div></div><div class="flex items-center"><span class="material-icons text-yellow-500 mr-3 text-2xl">arrow_downward</span><div class="text-gray-800 dark:text-white"><p class="font-bold">${formatTime(today.sunset)}</p></div></div></div>
            <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 interactive-element"><p class="text-gray-500 dark:text-gray-400">Humidity</p><p class="text-3xl sm:text-4xl font-bold my-4 text-gray-800 dark:text-white"><span>${Math.round(current.humidity)}</span> <span class="text-xl">%</span></p><div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-2 overflow-hidden"><div id="humidity-bar" class="bg-blue-600 dark:bg-blue-400 h-1.5 rounded-full progress-bar-animated" style="width: 0%"></div></div></div>
            <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 interactive-element"><p class="text-gray-500 dark:text-gray-400">Visibility</p><p class="text-3xl sm:text-4xl font-bold my-4 text-gray-800 dark:text-white"><span>${current.visibility}</span> <span class="text-xl">${distUnit}</span></p><div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-2 overflow-hidden"><div id="visibility-bar" class="bg-green-500 dark:bg-green-400 h-1.5 rounded-full progress-bar-animated" style="width: 0%"></div></div></div>
            <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 interactive-element"><p class="text-gray-500 dark:text-gray-400">Air Quality</p><p class="text-3xl sm:text-4xl font-bold my-4 text-gray-800 dark:text-white">${airQuality}</p><div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-2 overflow-hidden"><div id="air-quality-bar" class="bg-orange-500 dark:bg-orange-400 h-1.5 rounded-full progress-bar-animated" style="width: 0%"></div></div></div>
        `;
        
        // Animate progress bars after they are in the DOM
        setTimeout(() => {
            document.getElementById('uv-progress').style.strokeDasharray = `${(today.uvindex / constants.MAX_UV_INDEX) * 100}, 100`;
            document.getElementById('humidity-bar').style.width = `${current.humidity}%`;
            document.getElementById('visibility-bar').style.width = `${(current.visibility / constants.MAX_VISIBILITY_KM) * 100}%`;
            document.getElementById('air-quality-bar').style.width = `${(airQuality / constants.MAX_AQI) * 100}%`;
        }, 100);
    }

    // --- Event Handlers ---

    function toggleForecastView(view) {
        if (view === 'today') {
            elements.hourlySection.classList.remove(constants.CLASSES.VIEW_HIDDEN);
            elements.weeklySection.classList.add(constants.CLASSES.VIEW_HIDDEN);
            updateButtonStyles(elements.todayButton, [elements.weekButton], constants.CLASSES.ACTIVE_BUTTON_PRIMARY, constants.CLASSES.INACTIVE_BUTTON_PRIMARY);
        } else {
            elements.hourlySection.classList.add(constants.CLASSES.VIEW_HIDDEN);
            elements.weeklySection.classList.remove(constants.CLASSES.VIEW_HIDDEN);
            updateButtonStyles(elements.weekButton, [elements.todayButton], constants.CLASSES.ACTIVE_BUTTON_PRIMARY, constants.CLASSES.INACTIVE_BUTTON_PRIMARY);
        }
    }

    function setUnit(unit) {
        if (unitGroup === unit) return;
        unitGroup = unit;
        if (unit === 'metric') {
            updateButtonStyles(elements.celsiusButton, [elements.fahrenheitButton], constants.CLASSES.ACTIVE_BUTTON_SECONDARY, constants.CLASSES.INACTIVE_BUTTON_SECONDARY);
        } else {
            updateButtonStyles(elements.fahrenheitButton, [elements.celsiusButton], constants.CLASSES.ACTIVE_BUTTON_SECONDARY, constants.CLASSES.INACTIVE_BUTTON_SECONDARY);
        }
        if (elements.locationName.textContent) {
            fetchWeatherData(elements.locationName.textContent);
        }
    }

    function setTheme(theme) {
        localStorage.setItem('theme', theme);
        const themeIcon = elements.themeToggleButton.querySelector('.material-icons');
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
            themeIcon.textContent = 'dark_mode';
        } else {
            document.documentElement.classList.remove('dark');
            themeIcon.textContent = 'light_mode';
        }
    }

    // --- Initialization ---
    
    function initializeApp() {
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (savedTheme) {
            setTheme(savedTheme);
        } else if (prefersDark) {
            setTheme('dark');
        } else {
            setTheme('light');
        }

        // Set default button states
        updateButtonStyles(elements.todayButton, [elements.weekButton], constants.CLASSES.ACTIVE_BUTTON_PRIMARY, constants.CLASSES.INACTIVE_BUTTON_PRIMARY);
        updateButtonStyles(elements.celsiusButton, [elements.fahrenheitButton], constants.CLASSES.ACTIVE_BUTTON_SECONDARY, constants.CLASSES.INACTIVE_BUTTON_SECONDARY);

        fetchWeatherData('Ottawa, Canada');
    }

    initializeApp();
});
