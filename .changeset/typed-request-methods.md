---
"@rexeus/typeweaver-core": minor
"@rexeus/typeweaver-server": minor
---

Add `isHttpMethod` to narrow a method token to `HttpMethod`. The Fetch-native server no longer types
an unknown method such as `PROPFIND` as an `HttpMethod`: the app answers it with the router's 404 or
405 response before middleware runs, and `FetchApiAdapter.toRequest` rejects it with a `TypeError`.
