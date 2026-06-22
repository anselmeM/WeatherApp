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

  let humidityRating = "Normal 🤙";
  if (current.humidity < 30) humidityRating = "Dry 🌵";
  else if (current.humidity > 70) humidityRating = "Humid 🥵";

  let visibilityRating = "Average 🙁";
  if (current.visibility >= 10) visibilityRating = "Clear View 😎";

  let aqiEmoji = "👍";
  if (aqi > 100) aqiEmoji = "👎";
  else if (aqi > 50) aqiEmoji = "🤙";

  highlightsGrid.innerHTML = `
          <!-- UV Index Card -->
          <div class="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm flex flex-col justify-between aspect-[4/3] max-h-56 border border-gray-100/50 dark:border-slate-800 interactive-element">
              <p class="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-2">UV Index</p>
              <div class="flex-grow flex flex-col items-center justify-center relative mt-4">
                  <svg viewBox="0 0 100 50" class="w-full h-auto max-w-[150px] overflow-visible">
                      <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#f3f4f6" class="dark:stroke-slate-800" stroke-width="12" stroke-linecap="round" />
                      <path id="uv-progress" d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#fbbf24" stroke-width="12" stroke-linecap="round" stroke-dasharray="0, 125.66" class="progress-bar-animated" />
                  </svg>
                  <p class="absolute bottom-0 text-4xl font-black text-gray-800 dark:text-white" id="hl-uv-val">0</p>
              </div>
          </div>

          <!-- Wind Status Card -->
          <div class="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm flex flex-col justify-between aspect-[4/3] max-h-56 border border-gray-100/50 dark:border-slate-800 interactive-element">
              <p class="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-2">Wind Status</p>
              <h3 class="text-4xl font-light text-gray-800 dark:text-white my-auto"><span id="hl-wind-val">0</span> <span class="text-lg font-medium text-gray-400 dark:text-gray-500">${speedUnit}</span></h3>
              <div class="flex items-center space-x-3 text-sm font-medium mt-2">
                  <div class="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-200/50" style="transform: rotate(${current.winddir}deg)">
                      <span class="material-icons text-sm">navigation</span>
                  </div>
                  <span class="text-gray-700 dark:text-gray-300 text-sm font-semibold">${getWindDirection(current.winddir)}</span>
              </div>
          </div>

          <!-- Sunrise & Sunset Card -->
          <div class="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm flex flex-col justify-between aspect-[4/3] max-h-56 border border-gray-100/50 dark:border-slate-800 interactive-element">
              <p class="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-4">Sunrise & Sunset</p>
              <div class="space-y-4 my-auto">
                  <div class="flex items-center space-x-4">
                      <div class="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-500/20 flex items-center justify-center text-yellow-500 shadow-sm border border-yellow-50/20">
                          <span class="material-icons text-lg">arrow_upward</span>
                      </div>
                      <div>
                          <p class="text-[10px] font-semibold text-gray-400 dark:text-gray-500">Sunrise</p>
                          <p class="font-bold text-gray-800 dark:text-white text-[15px]">${formatTime(today.sunrise)}</p>
                      </div>
                  </div>
                  <div class="flex items-center space-x-4">
                      <div class="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center text-orange-500 shadow-sm border border-orange-50/20">
                          <span class="material-icons text-lg">arrow_downward</span>
                      </div>
                      <div>
                          <p class="text-[10px] font-semibold text-gray-400 dark:text-gray-500">Sunset</p>
                          <p class="font-bold text-gray-800 dark:text-white text-[15px]">${formatTime(today.sunset)}</p>
                      </div>
                  </div>
              </div>
          </div>

          <!-- Humidity Card -->
          <div class="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm flex flex-col justify-between aspect-[4/3] max-h-56 border border-gray-100/50 dark:border-slate-800 interactive-element">
              <p class="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">Humidity</p>
              <div class="flex justify-between items-center my-auto">
                  <h3 class="text-4xl font-light text-gray-800 dark:text-white"><span id="hl-humidity-val">0</span><span class="text-xl align-top font-normal text-gray-400">%</span></h3>
                  <div class="w-4.5 h-20 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden flex flex-col justify-end border border-gray-200/20 p-[2px]">
                      <div id="humidity-bar" class="w-full bg-blue-500 rounded-full progress-bar-animated" style="height: 0%"></div>
                  </div>
              </div>
              <p class="text-[13px] font-semibold text-gray-700 dark:text-gray-300 mt-2">${humidityRating}</p>
          </div>

          <!-- Visibility Card -->
          <div class="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm flex flex-col justify-between aspect-[4/3] max-h-56 border border-gray-100/50 dark:border-slate-800 interactive-element">
              <p class="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">Visibility</p>
              <div class="flex justify-between items-center my-auto">
                  <h3 class="text-4xl font-light text-gray-800 dark:text-white"><span id="hl-visibility-val">0</span> <span class="text-xl font-normal text-gray-400">${distUnit}</span></h3>
                  <div class="w-4.5 h-20 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden flex flex-col justify-end border border-gray-200/20 p-[2px]">
                      <div id="visibility-bar" class="w-full bg-emerald-500 rounded-full progress-bar-animated" style="height: 0%"></div>
                  </div>
              </div>
              <p class="text-[13px] font-semibold text-gray-700 dark:text-gray-300 mt-2">${visibilityRating}</p>
          </div>

          <!-- Air Quality Card -->
          <div class="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm flex flex-col justify-between aspect-[4/3] max-h-56 border border-gray-100/50 dark:border-slate-800 interactive-element">
              <p class="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">Air Quality</p>
              <div class="flex justify-between items-center my-auto">
                  <h3 class="text-4xl font-light text-gray-800 dark:text-white"><span id="hl-aqi-val">--</span></h3>
                  <div class="w-4.5 h-20 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden flex flex-col justify-end border border-gray-200/20 p-[2px]">
                      <div id="air-quality-bar" class="w-full ${aqiColorClass} rounded-full progress-bar-animated" style="height: 0%"></div>
                  </div>
              </div>
              <p class="text-[13px] font-semibold text-gray-700 dark:text-gray-300 mt-2">${airQualityLabel} ${aqiEmoji}</p>
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
      const uvCircumference = Math.PI * 40; // 125.66
      const val = Math.min(12, today.uvindex || 0);
      uvProgress.style.strokeDasharray = `${(val / 12) * uvCircumference}, ${uvCircumference}`;
    }
    if (humidityBar) humidityBar.style.height = `${current.humidity}%`;
    if (visibilityBar) visibilityBar.style.height = `${Math.min(100, (current.visibility / 16) * 100)}%`;
    if (airQualityBar) {
      const aqiProgress = aqi !== null && aqi !== undefined ? Math.min(100, (aqi / 300) * 100) : 0;
      airQualityBar.style.height = `${aqiProgress}%`;
    }
  }, 100);
}
