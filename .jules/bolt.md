## 2024-05-24 - Intl.DateTimeFormat Caching
**Learning:** In JavaScript, repeatedly calling `new Date().toLocaleDateString()` inside loops (like generating forecast UI cards) is surprisingly expensive due to the overhead of instantiating the formatter object on every call. Benchmarks show a ~99% performance improvement by caching the `Intl.DateTimeFormat` instance.
**Action:** Always extract and cache `Intl.DateTimeFormat` instances at the module scope when formatting dates frequently or within rendering loops.
## 2024-05-24 - Coordinate Filtering Optimization
**Learning:** Defining regular expressions as constants outside of loops or iteration methods (like `.filter()`) reduces CPU overhead. Using `RegExp.prototype.test()` instead of `String.prototype.match()` for boolean checks avoids array allocations. In micro-benchmarks on this codebase, optimizing coordinate filtering demonstrated a ~50% performance improvement (1.380s vs 642ms for 10k iterations).
**Action:** Extract inline regexes out of loops/callbacks and prefer `.test()` over `.match()` for boolean checks.
