import { getDisplayTemp } from '../state.js';
import { getWeatherIcon, formatTime } from '../../utils.js';
import { getWeatherIconColor, shortWeekdayFormatter, showUpgradePrompt } from '../ui-render.js';

export function updateHourlyForecast(today, tempUnit) {
  const hourlyContainer = document.getElementById("hourly-forecast-container");
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
  const forecastGrid = document.getElementById("forecast-grid");
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
