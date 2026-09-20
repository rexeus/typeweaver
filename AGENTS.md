# TypeWeaver contributor guidance

## Repository contract

Read `VISION.md` for the product direction and the repository documentation before changing a public
contract. Keep implementation, public documentation, generated fixtures, Changesets, and migration
notes synchronized at each public-contract boundary. A local `plans/` directory may hold working
notes, but it is gitignored and never part of the published repository.

## Toolchain

- Node.js >=24.0.0. With nvm, run `nvm use 24`.
- pnpm@10.34.5, as pinned by `packageManager` in `package.json`.
- Turborepo coordinates workspace tasks.
- tsdown builds published packages.
- `@rexeus/typeweaver-tsconfig`, a private and unpublished workspace package, owns the shared
  TypeScript compiler profiles: `base.json`, `node.json`, and `checkjs.json`. See
  [`packages/tsconfig/README.md`](./packages/tsconfig/README.md).
- Oxlint enforces lint, type-aware semantic safety, and maintainability rules. `pnpm lint` is
  warning-free and requires `exactOptionalPropertyTypes`-clean code.
- Oxfmt formats source and documentation.
- Vitest runs unit, integration, and generation tests.

Repository `.mjs` tooling under `scripts/**` and `config/tsdown/**` is a checked-JavaScript project
(`scripts/tsconfig.json` extends the `checkjs.json` profile) rather than a globally permissive
`allowJs` setting.

Do not substitute other build, lint, or formatting tools without an explicit repository-wide
decision. Install with `pnpm install --frozen-lockfile`.

## Package map

| Package                                 | Role                                                                         |
| --------------------------------------- | ---------------------------------------------------------------------------- |
| `@rexeus/typeweaver`                    | CLI, configuration loading, spec bundling, and generation orchestration      |
| `@rexeus/typeweaver-core`               | Public authoring API, HTTP contracts, and shared runtime types               |
| `@rexeus/typeweaver-gen`                | Normalized model, plugin contract, generation services, and helpers          |
| `@rexeus/typeweaver-types`              | Generated request/response types and validators                              |
| `@rexeus/typeweaver-clients`            | Generated Fetch clients and request commands                                 |
| `@rexeus/typeweaver-server`             | Generated Fetch-native routers, handlers, app, and middleware                |
| `@rexeus/typeweaver-hono`               | Generated Hono routers and handlers                                          |
| `@rexeus/typeweaver-aws-cdk`            | Generated AWS CDK API Gateway helpers                                        |
| `@rexeus/typeweaver-openapi`            | OpenAPI document builder and generator plugin                                |
| `@rexeus/typeweaver-zod-to-ts`          | Zod-to-TypeScript conversion                                                 |
| `@rexeus/typeweaver-zod-to-json-schema` | Zod-to-JSON-Schema conversion                                                |
| `test-utils`                            | Private shared fixtures, factories, test servers, and generated test project |
| `@rexeus/typeweaver-tsconfig`           | Private shared TypeScript compiler profiles; not published                   |

## Working rules

- Change authoring definitions, generators, or templates and regenerate outputs; never hand-edit
  generated fixtures. Generated directories keep a lint exclusion only because templates, generation
  tests, generated typechecks, and `pnpm verify:generated` govern the output at its source.
- Establish a failing test or characterization before changing behavior. Run the narrow package
  check after each logical change, then the required repository gate.
- Prefer `unknown` plus explicit validation at external boundaries. Do not introduce `any`, unsafe
  assertions, ignored type errors, skipped tests, or muted lint rules to pass a gate.
- Keep code inside the enforced cognitive and structural limits and resolve findings by cohesive
  decomposition. Do not add a size allowlist, per-file override, or unlisted `oxlint-disable`
  directive; the authored suppression allowlist is exact and tested by
  `pnpm test:maintainability-lint`.
- Preserve deterministic generation, path safety, transactional publication, and per-call isolation.
- Public contract changes require runtime and type tests, a Changeset, and migration documentation.
- Public examples must be executable or mapped to typechecked fixtures.
- Use English Conventional Commits and keep commits focused at green boundaries.

Tests normally live in `__test__/` and use `*.test.ts`; shared factories and the integration spec
belong in `packages/test-utils`. Run the CLI locally with
`pnpm --filter @rexeus/typeweaver run cli -- <arguments>`. After a full build, run the frozen
install again to recreate CLI binary symlinks before generation or bundle tests.

## Effect work

The active baseline is Effect 3.22.0 with public peer range `>=3.22.0 <4`. Before changing Effect
code, read `.agents/skills/effect-ts/SKILL.md` and its pinned Effect 3 reference, then run:

```sh
pnpm verify:effect-reference
```

Do not use Effect 4 APIs or edit `.repos/effect`. Effect must remain optional for core, client,
Hono, and Fetch-native server consumers.

## Verification

Start narrow. The common repository checks are:

```sh
pnpm build
pnpm typecheck
pnpm docs:check
pnpm format:check
pnpm lint
pnpm test
```

The strict toolchain adds focused contracts: `pnpm test:typescript-toolchain`,
`pnpm test:lint-policy`, `pnpm test:maintainability-lint`, `pnpm typecheck:scripts`,
`pnpm test:tooling`, and `pnpm test:quality-contracts`. `pnpm verify:architecture-contracts`
composes the compiler, lint, scripts-typecheck, tooling, quality-task, and public-contract checks in
a deterministic order.

Before completing a public-contract change, run the common checks above and
`pnpm verify:architecture-contracts`; that gate covers generated fixtures, the Effect version
contract, packed consumers, and package-manager contracts. Run
`pnpm --filter @rexeus/typeweaver run test:bundle:all` for the multi-runtime bundle gate, then run
dry-run publishing and finish with a clean-worktree check.
