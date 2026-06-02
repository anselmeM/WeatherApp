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

// ⚡ Bolt: Cache Intl.DateTimeFormat instance to avoid costly initialization on every formatTime call
const timeFormatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
});

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
    return timeFormatter
      .format(date)
      .replace(" ", "");
}

export function showToast(message, type = 'error', errorType = 'generic') {
    const toastBox = document.createElement("div");
    
    // 🛡️ UX: Differentiated error messages based on type/errorType
    let displayMessage = message;
    let showRetry = false;
    
    if (type === 'error') {
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
    }
    
    // Build toast using safe DOM methods
    const container = document.createElement("div");
    container.className = "flex items-start";

    const iconSpan = document.createElement("span");
    iconSpan.className = "material-icons mr-2";
    if (type === 'success') {
      iconSpan.textContent = "check_circle_outline";
    } else if (type === 'warning') {
      iconSpan.textContent = "warning_amber";
    } else {
      iconSpan.textContent = "error_outline";
    }
    container.appendChild(iconSpan);

    const messageSpan = document.createElement("span");
    messageSpan.className = "flex-grow";
    messageSpan.textContent = displayMessage;
    container.appendChild(messageSpan);

    let retryBtn = null;
    if (showRetry) {
      retryBtn = document.createElement("button");
      retryBtn.className = "retry-btn ml-2 bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg text-sm font-bold";
      retryBtn.textContent = "Retry";
      container.appendChild(retryBtn);
    }
    
    toastBox.appendChild(container);
    
    // Determine color class based on type
    let bgClass = "bg-red-600/90";
    if (type === 'success') {
      bgClass = "bg-green-600/90";
    } else if (type === 'warning') {
      bgClass = "bg-yellow-600/90";
    }
    
    toastBox.className =
      `fixed top-5 right-5 ${bgClass} backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl z-50 transition-all duration-500 transform translate-x-[120%] max-w-sm`;
    // 🛡️ Accessibility: Add ARIA role for screen reader announcement
    toastBox.setAttribute("role", "alert");
    toastBox.setAttribute("aria-live", "assertive");
    document.body.appendChild(toastBox);
    setTimeout(() => {
      toastBox.classList.remove("translate-x-[120%]");
    }, 50);
    setTimeout(() => {
      toastBox.classList.add("translate-x-[120%]");
      toastBox.addEventListener("transitionend", () => toastBox.remove());
    }, 5000);
    
    // Attach retry handler if button exists
    if (showRetry && retryBtn) {
      retryBtn.addEventListener('click', () => {
        toastBox.classList.add("translate-x-[120%]");
        // Trigger a fresh weather fetch using a CustomEvent (L-1)
        document.dispatchEvent(new CustomEvent('weather-retry'));
      });
    }
    
    return toastBox;
}

export function showError(message, errorType = 'generic') {
  return showToast(message, 'error', errorType);
}

