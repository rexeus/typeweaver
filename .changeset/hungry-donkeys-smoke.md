---
"@rexeus/typeweaver-clients": patch
---

- Fix ApiClient URL construction to support relative base paths
  - ApiClient now uses string concatenation instead of `new URL()` for path construction, allowing
    relative base paths like `/api` without requiring a full origin URL.
