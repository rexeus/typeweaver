# Effect Source Setup

This repository uses the exact Effect `4.0.0-rc.116` release candidate. Its local source reference
must match that production baseline; an Effect 3 checkout or a different Effect 4 release candidate
is not a valid reference for TypeWeaver.

## Setup

From the repository root, run:

```sh
pnpm prepare
```

The `scripts/prepare-effect-reference.mjs` task reads the authoritative version contract from
`config/effect-baseline.json`, then prepares:

- path: `./.repos/effect`;
- source: `https://github.com/Effect-TS/effect.git`;
- tag: `effect@4.0.0-rc.116`;
- detached commit: `d62dd0d65252e5d3635538f0e41adc7c08aa9beb`.

The checkout is ignored by Git. The prepare task is idempotent, verifies the package version,
origin, and commit, and refuses to overwrite a dirty local checkout.

Run the guard independently with:

```sh
pnpm verify:effect-reference
```

## Guidance

- Do not clone `effect-smol` or an unpinned default branch for this repository.
- Do not continue Effect-specific work until the reference guard passes.
- Use the Effect 4.0.0-rc.116 source under `./.repos/effect` for source-level confirmation.
- The public plugin peer contract is the exact release candidate `4.0.0-rc.116`.
