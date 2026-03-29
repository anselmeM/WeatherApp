// utils.js

export function getWeatherIcon(condition) {
    const iconMap = {
      "partly-cloudy-day": "cloud",
      "partly-cloudy-night": "cloud",
      cloudy: "cloud",
      "clear-day": "wb_sunny",
      "clear-night": "nightlight_round",
      rain: "grain",
      snow: "ac_unit",
      sleet: "ac_unit",
      wind: "air",
      fog: "foggy",
      thunderstorm: "thunderstorm",
    };
    return iconMap[condition] || "cloud";
}

export function getWindDirection(deg) {
    if (typeof deg !== 'number' || !isFinite(deg)) {
        return undefined;
    }
    const directions = [
      "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
      "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"
    ];
    const index = Math.round(((deg % 360) + 360) % 360 / 22.5);
    return directions[index % 16];
}

export function formatTime(timeStr) {
    if (!timeStr) return "";
    const match = timeStr.match(/^(?<hour>\d{1,2}):(?<minute>\d{2})(?::(?<second>\d{2}))?$/);
    if (!match) {
        return "";
    }
    const hour = parseInt(match.groups.hour, 10);
    const minute = parseInt(match.groups.minute, 10);
    const second = match.groups.second;

    if (hour > 23 || minute > 59 || (second && parseInt(second, 10) > 59)) {
        return "";
    }
    const date = new Date(2023, 0, 1, hour, minute);
    return date
       .toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
      .replace(" ", "");
}

export function showError(message, errorType = 'generic') {
    const errorBox = document.createElement("div");
    
    // 🛡️ UX: Differentiated error messages based on type
    let displayMessage = message;
    let showRetry = false;
    
    if (errorType === 'network') {
      displayMessage = `Network error: ${message}`;
      showRetry = true;
    } else if (errorType === 'timeout') {
      displayMessage = 'Request timed out. Please check your connection and try again.';
      showRetry = true;
    } else if (errorType === 'api') {
      displayMessage = `Weather service unavailable: ${message}`;
      showRetry = true;
    } else if (errorType === 'location') {
      displayMessage = `Location not found: ${message}`;
    }
    
    // Build error toast HTML with optional retry button
    errorBox.innerHTML = `
      <div class="flex items-start">
        <span class="material-icons mr-2">error_outline</span>
        <span class="flex-grow">${displayMessage}</span>
        ${showRetry ? '<button class="retry-btn ml-2 bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg text-sm font-bold">Retry</button>' : ''}
      </div>
    `;
    
    errorBox.className =
      "fixed top-5 right-5 bg-red-600/90 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl z-50 transition-all duration-500 transform translate-x-[120%] max-w-sm";
    // 🛡️ Accessibility: Add ARIA role for screen reader announcement
    errorBox.setAttribute("role", "alert");
    errorBox.setAttribute("aria-live", "assertive");
    document.body.appendChild(errorBox);
    setTimeout(() => {
      errorBox.classList.remove("translate-x-[120%]");
    }, 50);
    setTimeout(() => {
      errorBox.classList.add("translate-x-[120%]");
      errorBox.addEventListener("transitionend", () => errorBox.remove());
    }, 5000);
    
    // Attach retry handler if button exists
    if (showRetry) {
      const retryBtn = errorBox.querySelector('.retry-btn');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => {
          errorBox.classList.add("translate-x-[120%]");
          // Trigger a fresh weather fetch - location will come from current UI state
          if (typeof window.triggerWeatherRefresh === 'function') {
            window.triggerWeatherRefresh();
          }
        });
      }
    }
    
    return errorBox;
}
