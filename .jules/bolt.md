## 2024-05-24 - Intl.DateTimeFormat Caching
**Learning:** In JavaScript, repeatedly calling `new Date().toLocaleDateString()` inside loops (like generating forecast UI cards) is surprisingly expensive due to the overhead of instantiating the formatter object on every call. Benchmarks show a ~99% performance improvement by caching the `Intl.DateTimeFormat` instance.
**Action:** Always extract and cache `Intl.DateTimeFormat` instances at the module scope when formatting dates frequently or within rendering loops.
## 2024-06-25 - Caching Regular Expressions for Performance
**Learning:** Defining regular expressions inside frequently called loops or functions (like the coordinate matcher in `.filter()`) forces the JavaScript engine to recompile and allocate memory for the RegExp object on every invocation. Furthermore, `.match()` creates full match arrays even when a simple boolean check is needed, increasing CPU load and garbage collection overhead.
**Action:** Always extract static regular expressions to the module scope as constants, and prefer `RegExp.prototype.test()` over `String.prototype.match()` when only a boolean result is required.
