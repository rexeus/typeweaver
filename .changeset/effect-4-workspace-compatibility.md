---
"@rexeus/typeweaver": patch
"@rexeus/typeweaver-gen": patch
"@rexeus/typeweaver-effect": patch
---

This historical workspace-compatibility note is superseded by the native Effect 4.0.0-rc.116
migration. Current version, packed-consumer, and doctor contracts are documented in ADR 0008 and the
native Effect changeset. The retained doctor behavior resolves the project declaration at its boundary
and reports `TW-DOCTOR-011` truthfully when the exact native runtime is absent.
