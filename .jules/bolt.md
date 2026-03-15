
## 2024-03-14 - [Memory optimization and LRU Cache Policy]
 **Learning:** Client-side caches (e.g. Map objects) without size limits can cause memory exhaustion as users navigate. Also, LRU (Least Recently Used) is often a better eviction strategy than FIFO for data fetched often.
 **Action:** Enforce size constraints on client-side cache stores, using a constant like MAX_IMAGE_CACHE_SIZE and removing the oldest items with FIFO. For backend data caches, implement simple LRU logic by refreshing items on access (`map.delete(key)` then `map.set(key, item)`).

## 2025-05-14 - Batch DOM Appends with DocumentFragment
**Learning:** Appending elements individually to the live DOM inside a loop causes multiple reflows and repaints. Even if the number of elements is small (5-12), using a `DocumentFragment` to batch appends is a best practice that ensures consistent performance and avoids layout thrashing.
**Action:** Always check for loops that perform DOM appends and use `DocumentFragment` to batch them into a single update.
