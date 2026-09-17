---
"@rexeus/typeweaver-zod-to-json-schema": patch
"@rexeus/typeweaver-openapi": patch
---

Skip the internal `never` catchall when collecting object-schema warnings so Zod strict objects no
longer report the representable `additionalProperties: false` conversion as `unsupported-schema`.
Genuine lossy-schema warnings for `z.custom()`, transforms, unsupported checks, and non-`never`
catchalls are unchanged. This is a warning-only patch; no migration is required.
