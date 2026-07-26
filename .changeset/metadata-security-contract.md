---
"@rexeus/typeweaver-core": minor
"@rexeus/typeweaver-gen": minor
---

Require generator-neutral API metadata in `defineSpec`, add first-class HTTP, API-key, OAuth2, and
OpenID Connect security declarations, and normalize effective resource and operation security with
explicit inheritance-source information.

Normalization now rejects duplicate schemes and tags, unknown references and OAuth2 scopes,
malformed security URLs, invalid requirement objects, and contradictory HTTP authorization-header
schemas with exported structured errors.
