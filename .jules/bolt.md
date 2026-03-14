
## 2024-03-14 - [Memory optimization and LRU Cache Policy]
 **Learning:** Client-side caches (e.g. Map objects) without size limits can cause memory exhaustion as users navigate. Also, LRU (Least Recently Used) is often a better eviction strategy than FIFO for data fetched often.
 **Action:** Enforce size constraints on client-side cache stores, using a constant like MAX_IMAGE_CACHE_SIZE and removing the oldest items with FIFO. For backend data caches, implement simple LRU logic by refreshing items on access (`map.delete(key)` then `map.set(key, item)`).
