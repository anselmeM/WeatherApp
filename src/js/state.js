// ⚡ Bolt: Define regex outside loop and use .test() instead of .match() for boolean checks
const coordinatePattern = /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/;

export const state = {
  unitGroup: localStorage.getItem("unitGroup") || "metric",
  fetchedUnitGroup: null, // Tracks the unit weather data was originally fetched in
  currentWeatherData: null,
  isInitialLoad: true,
  recentSearches: JSON.parse(localStorage.getItem("recentSearches") || "[]").filter(c => !coordinatePattern.test(c)),
};

export function getDisplayTemp(tempVal) {
  if (tempVal === undefined || tempVal === null) return '--';
  if (state.unitGroup === state.fetchedUnitGroup) {
    return Math.round(tempVal);
  }
  if (state.unitGroup === 'metric') {
    // Data was fetched in Fahrenheit (US), convert to Celsius (metric)
    return Math.round((tempVal - 32) * 5 / 9);
  } else {
    // Data was fetched in Celsius (metric), convert to Fahrenheit (US)
    return Math.round(tempVal * 9 / 5 + 32);
  }
}
