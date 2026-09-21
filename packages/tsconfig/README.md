# `@rexeus/typeweaver-tsconfig`

Private workspace package that owns the shared TypeScript compiler profiles. It is marked
`"private": true`, so pnpm excludes it from publication and the packed-consumer inventory, and it
carries no public compatibility promise; consuming projects extend the JSON files directly.

## Profiles

| Profile        | Extends     | Purpose                                                                                      |
| -------------- | ----------- | -------------------------------------------------------------------------------------------- |
| `base.json`    | —           | Strict, environment-neutral compiler baseline; Effect diagnostics run in the standalone gate |
| `node.json`    | `base.json` | Node.js runtime profile; adds the `node` type library                                        |
| `checkjs.json` | `node.json` | Checked-JavaScript project for repository tooling (`.mjs`); enables `allowJs`/`checkJs`      |

## Intended consumers

- **`base.json`** — projects that must not assume ambient runtime globals. The profile keeps
  `types: []`, so a Node global such as `process` is a `TS2591` error until a runtime profile opts
  in.
- **`node.json`** — the root `tsconfig.json`, every published `packages/*/tsconfig.json`, and the
  test, example, and Effect-diagnostic projects that run on Node.js.
- **`checkjs.json`** — the checked-JavaScript project for repository tooling.
  `scripts/tsconfig.json` extends this profile and covers every `.mjs` file under `scripts/**`,
  `config/tsdown/**`, and `config/oxlint/**`; `pnpm typecheck:scripts` runs it with `--noEmit`.

Each consuming project may widen `rootDir`/`include` or override `noEmit`, but must not disable a
strictness option.

## Adopted compiler options

`base.json` owns the strictness surface so it cannot drift per package:

- **Strict family:** `strict`, `alwaysStrict`, `strictBindCallApply`, `strictFunctionTypes`,
  `strictNullChecks`, `strictPropertyInitialization`, `noImplicitAny`, `noImplicitThis`,
  `noImplicitOverride`, `noImplicitReturns`.
- **Soundness beyond `strict`:** `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `noPropertyAccessFromIndexSignature`, `noUncheckedSideEffectImports`,
  `useUnknownInCatchVariables`, `noFallthroughCasesInSwitch`, `noUnusedLocals`,
  `noUnusedParameters`, `allowUnreachableCode: false`.
- **Module and language:** `module: "NodeNext"`, `moduleResolution: "NodeNext"`,
  `moduleDetection: "force"`, `target: "ESNext"`, `verbatimModuleSyntax`, `isolatedModules`.
- **Deliberately retained:** `skipLibCheck: true`. It is not removed until characterization proves
  the full dependency and declaration matrix clean.

## Usage

Published package projects build with tsdown and extend the Node profile:

```json
{
  "extends": "@rexeus/typeweaver-tsconfig/node.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist" },
  "include": ["src/**/*.ts"]
}
```

Repository tooling is a checked-JavaScript project rather than a globally permissive `allowJs`
setting:

```json
{
  "extends": "@rexeus/typeweaver-tsconfig/checkjs.json",
  "include": ["*.mjs", "lib/**/*.mjs"]
}
```

## Executable contract

`pnpm test:typescript-toolchain` writes throwaway projects that extend each exported profile and
asserts the effective options plus the exact diagnostic code for every valid and invalid probe. It
currently proves 20 compiler options and 18 diagnostics across the four profiles (`base`, `node`,
`checkjs`, and the root config) and fails when a profile is weakened.
