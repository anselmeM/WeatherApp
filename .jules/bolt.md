
## 2024-03-14 - [Memory optimization and LRU Cache Policy]
 **Learning:** Client-side caches (e.g. Map objects) without size limits can cause memory exhaustion as users navigate. Also, LRU (Least Recently Used) is often a better eviction strategy than FIFO for data fetched often.
 **Action:** Enforce size constraints on client-side cache stores, using a constant like MAX_IMAGE_CACHE_SIZE and removing the oldest items with FIFO. For backend data caches, implement simple LRU logic by refreshing items on access (`map.delete(key)` then `map.set(key, item)`).

## 2024-05-28 - In-memory cache for autocomplete queries
 **Learning:** Client-side in-memory caching for frequent operations like autocomplete API queries combined with validating that the resolved query is still the current input prevents redundant network requests and rendering stale results due to fast typing.
 **Action:** Implement a `Map` with a maximum size limit and FIFO eviction for autocomplete-like operations and always verify query freshness before rendering results.
