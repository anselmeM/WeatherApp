import { state, getDisplayTemp } from '../state.js';
import { getWindDirection, formatTime } from '../../utils.js';
import { animateCounter } from '../ui-render.js';

export function updateHighlights(today, current, speedUnit, distUnit) {
  const highlightsGrid = document.getElementById("highlights-grid");
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
