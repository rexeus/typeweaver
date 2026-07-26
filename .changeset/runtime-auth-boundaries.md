---
"@rexeus/typeweaver-clients": patch
"@rexeus/typeweaver-command": patch
---

Treat HTTP header names case-insensitively when request headers override client defaults, and encode
generated command-client Basic credentials as UTF-8 before Base64 conversion.
