## 🎯 What
Added an in-memory cache for the autocomplete dropdown queries and resolved a race condition where stale results could be rendered for a subsequent faster API response.

## 💡 Why
- Implemented a `Map` based cache to significantly cut down on redundant network queries when a user retypes or backspaces matching queries.
- Prevented the search path from rendering stale API responses by checking that the current normalized input matches the query that triggered the response before populating the autocomplete dropdown (`renderAutocomplete()`).

## 📈 Impact
- Reduced rate-limiting/overload risks for external Open-Meteo geocoding API.
- Measurably improved responsiveness during input interaction due to immediate rendering of cached results.
- Prevented UI glitches where stale results appear for a new input character string.

## 📏 Measurement
- Interacted with the autocomplete menu, retyping matching queries, and verified using dev tools network tab that no subsequent network queries occurred for matching items while populating the UI.
- Validated via `pnpm test` that no regression errors were introduced.
