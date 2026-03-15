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
    if (typeof deg !== 'number' || isNaN(deg)) {
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
    const second = match.groups.second ? parseInt(match.groups.second, 10) : null;

    if (hour > 23 || minute > 59 || (second !== null && second > 59)) {
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

export function showError(message) {
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
