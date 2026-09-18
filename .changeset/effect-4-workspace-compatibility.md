---
"@rexeus/typeweaver": patch
"@rexeus/typeweaver-gen": patch
"@rexeus/typeweaver-effect": patch
---

Document and prove Phase A Effect 4 workspace compatibility without widening any peer range. The only
evidenced Effect 4 version is `4.0.0-rc.115` (pnpm, strict peers); every other Effect 4 version is
UNVERIFIED. `typeweaver doctor` now resolves the project-declared Effect at the project boundary as
`TW-DOCTOR-011` (skipped only when the project does not declare Effect and no Effect-native or
custom plugin is configured; an undeclared project that selects the `effect` projection or a custom
plugin fails; a conditional warning for the exact `4.0.0-rc.115` pin with built-in plain
projections; UNVERIFIED warnings for any other Effect 4 version; and failure for the Effect-native
`effect` projection or a custom plugin unless the workspace declares a supported stable Effect 3
runtime). It also renames
`TW-DOCTOR-008` to the CLI's own bundled Effect runtime. The binary CLI remains usable in an Effect 4
workspace through process isolation, while the CLI programmatic API, `@rexeus/typeweaver-gen` plugin
authoring, first-party plugin imports, and `@rexeus/typeweaver-effect` stay on Effect `>=3.22.0 <4`.
Packed evidence covers all built-in plain projections and rejects a strict-peer Effect 4 install of
the Effect-native packages.

The CLI now validates the project-declared Effect with a direct `semver` dependency: `doctor` passes
only a stable release that satisfies the project's declared specifier under standard semver
(prereleases never pass), and a declaration that cannot be verified fails truthfully instead of
passing on a hoisted parent Effect.
