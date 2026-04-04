
## 2024-03-14 - [Memory optimization and LRU Cache Policy]
 **Learning:** Client-side caches (e.g. Map objects) without size limits can cause memory exhaustion as users navigate. Also, LRU (Least Recently Used) is often a better eviction strategy than FIFO for data fetched often.
 **Action:** Enforce size constraints on client-side cache stores, using a constant like MAX_IMAGE_CACHE_SIZE and removing the oldest items with FIFO. For backend data caches, implement simple LRU logic by refreshing items on access (`map.delete(key)` then `map.set(key, item)`).

## $(date +%Y-%m-%d) - [LRU Cache Eviction Policy]
**Learning:** For Map-based client-side caches, an LRU (Least Recently Used) eviction policy can be easily implemented by deleting and re-setting an entry on a cache hit. This pushes the entry to the end of the insertion order, preventing frequently used items from being evicted.
**Action:** When implementing Map caches with maximum sizes, always consider if LRU is more appropriate than FIFO, and implement it by refreshing the entry order on hits.

## 2026-03-22 - [Trimming Unused External API Data]
**Learning:** Caching raw external API responses without trimming unused nested properties (like hourly forecast data for future days) drastically inflates memory usage and network payload size, causing performance bottlenecks.
**Action:** Always inspect the required data payload for the frontend and aggressively trim unused fields from external API responses before caching and transmitting them.

## 2024-03-28 - [DOM Element Query Caching]
**Learning:** Repeating `document.getElementById` and `querySelector` calls within frequently executed functions (like rendering loops or resize handlers) introduces redundant DOM traversal overhead, degrading rendering performance.
**Action:** Cache DOM element references in the module initialization scope or within a higher-level context (e.g., `DOMContentLoaded` listener) to avoid repeatedly querying the DOM for the same elements.

## $(date +%Y-%m-%d) - [In-Memory Promise Caching for Deduplication]
**Learning:** Storing the resolved value of an API request in a client-side cache still leaves a race condition window: concurrent calls made before the first request resolves will trigger redundant network fetches.
**Action:** When implementing in-memory caching for frequent operations (like autocomplete queries or UI image fetching), store the *Promise* of the network request rather than the resolved value. This ensures that any subsequent calls while the request is "in-flight" will await the same Promise, successfully deduplicating the network overhead.
