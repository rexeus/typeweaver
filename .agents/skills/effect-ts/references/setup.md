# Effect Source Setup

This repository uses Effect 3.22.0. Its local source reference must match that production baseline;
an Effect 4 beta checkout is not a valid reference for TypeWeaver.

## Setup

From the repository root, run:

```sh
pnpm prepare
```

The `scripts/prepare-effect.sh` task reads the authoritative version contract from
`config/effect-baseline.json`, then prepares:

- path: `./.repos/effect`;
- source: `https://github.com/Effect-TS/effect.git`;
- tag: `effect@3.22.0`;
- detached commit: `e670e0f6befb959b84208d5f77631276521020ae`.

The checkout is ignored by Git. The prepare task is idempotent, verifies the package version,
origin, and commit, and refuses to overwrite a dirty local checkout.

Run the guard independently with:

```sh
pnpm verify:effect-reference
```

## Guidance

- Do not clone `effect-smol` or an unpinned default branch for this repository.
- Do not continue Effect-specific work until the reference guard passes.
- Use the Effect 3.22 source under `./.repos/effect` for source-level confirmation.
- The public plugin peer range is intentionally broader than the development reference:
  `>=3.21.2 <4`.
