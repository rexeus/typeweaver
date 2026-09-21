# Maintainability lint inventory

This page is the maintainer reference for TypeWeaver's Oxlint policy: the exact thresholds, the
type-aware semantic rules, the warning and suppression governance, the generated-code boundary, and
the executable contracts that keep the policy load-bearing. The compiler-profile side of the strict
toolchain lives in [`packages/tsconfig/README.md`](../packages/tsconfig/README.md).

## Historical baseline

The Oxlint maintainability gate was introduced on 2026-07-25 with the exact project thresholds from
`.oxlintrc.json`. The first full lint run reported 203 violations:

| Rule                            | Initial violations |
| ------------------------------- | -----------------: |
| `eslint/max-lines-per-function` |                133 |
| `eslint/complexity`             |                 29 |
| `eslint/max-nested-callbacks`   |                 18 |
| `eslint/max-params`             |                  9 |
| `sonarjs/cognitive-complexity`  |                  8 |
| `eslint/max-statements`         |                  4 |
| `sonarjs/expression-complexity` |                  2 |
| `eslint/max-depth`              |                  0 |
| `sonarjs/no-nested-switch`      |                  0 |

Of these findings, 144 were in tests, 55 were in package source code, and 4 were in repository
tooling. This inventory records the starting point only. It is not a suppression baseline: the
enforced target is zero violations with no size allowlist or per-file override, and `pnpm lint`
fails on any remaining finding.

Oxlint provides the compatibility-namespaced rules natively. The `sonarjs/*` rules are loaded
through Oxlint's JavaScript plugin support. Automatic pnpm peer installation is disabled so that the
SonarJS plugin cannot pull in its optional legacy linter peer; that separate linter is neither
declared nor installed.

## Type-aware semantic rules

`pnpm lint` runs `oxlint . --deny-warnings` with `options.typeAware: true`, so projects under
`packages/**` are analyzed with type information. The same semantic rules are enforced for authored
package source and for test containers:

| Rule                                     | Purpose                                            |
| ---------------------------------------- | -------------------------------------------------- |
| `typescript/consistent-type-definitions` | Require `type` aliases over `interface`.           |
| `typescript/no-explicit-any`             | Reject explicit `any`.                             |
| `typescript/no-floating-promises`        | Reject unhandled Promise results.                  |
| `typescript/no-misused-promises`         | Reject Promises used in a non-Promise position.    |
| `typescript/no-non-null-assertion`       | Reject `!` assertions.                             |
| `typescript/no-unsafe-argument`          | Reject `any` flowing into typed parameters.        |
| `typescript/no-unsafe-assignment`        | Reject `any` assignments.                          |
| `typescript/no-unsafe-call`              | Reject calls on `any`.                             |
| `typescript/no-unsafe-member-access`     | Reject member access on `any`.                     |
| `typescript/no-unsafe-return`            | Reject returning `any` from a typed function.      |
| `typescript/switch-exhaustiveness-check` | Require exhaustive switches over unions and enums. |

The root profile also enforces `eslint/no-eval`, `eslint/no-implied-eval`, `eslint/no-new-func`,
`unicorn/prefer-node-protocol`, and the import hygiene rules
`import/consistent-type-specifier-style`, `import/max-dependencies` (10), `import/no-cycle`,
`import/no-duplicates`, `import/no-named-default`, `import/no-namespace`, `import/no-self-import`,
and `import/no-unassigned-import`.

## Exact thresholds

These are the enforced values in `.oxlintrc.json`. No override may loosen them:

| Rule                            | Configuration                                            |
| ------------------------------- | -------------------------------------------------------- |
| `eslint/complexity`             | `max: 10`, `variant: "classic"`                          |
| `eslint/max-depth`              | `max: 3`                                                 |
| `eslint/max-lines`              | `max: 400`, `skipBlankLines: true`, `skipComments: true` |
| `eslint/max-lines-per-function` | `max: 60`, `skipBlankLines: true`, `skipComments: true`  |
| `eslint/max-nested-callbacks`   | `max: 3`                                                 |
| `eslint/max-params`             | `max: 4`, `countThis: "except-void"`                     |
| `eslint/max-statements`         | `max: 30`                                                |
| `sonarjs/cognitive-complexity`  | `15`                                                     |
| `sonarjs/expression-complexity` | `max: 6`                                                 |
| `sonarjs/no-nested-switch`      | `error`                                                  |

Test containers are declaration scaffolding rather than behavior, so the single documented test
override relaxes only the three container budgets `eslint/max-lines`,
`eslint/max-lines-per-function`, and `eslint/max-nested-callbacks`. Cognitive, expression, and
cyclomatic complexity, statement, parameter, depth, import, and every type-aware safety rule still
apply to tests.

## Warning and unused-disable policy

- `pnpm lint` passes `--deny-warnings`, so a warning-level diagnostic fails the gate.
- `options.reportUnusedDisableDirectives` is `"error"`: a disable directive that suppresses nothing
  fails the gate.
- `categories.correctness` is `"error"` across the repository.

## Generated-code and exclusion policy

`ignorePatterns` excludes `**/dist/**`, `**/node_modules/**`, `.vscode/**`, `**/output/**`, and
`**/outputs/**`. The authored-source override additionally excludes `tsdown.config.ts`,
`examples/**`, `fixtures/**`, `test-fixtures/**`, and `serve-*.ts` from the structural/semantic
profile.

Generated code is governed at its source: change authoring definitions, generators, or templates and
regenerate fixtures; never hand-edit generated output. `pnpm verify:generated` reproduces the
generated CLI test project deterministically, generated projects are typechecked by their owning
packages and packed consumers, and `pnpm test:quality-contracts` proves the scripts-typecheck and
root-tooling tasks reject broken fixtures. A lint exclusion is never used to hide unsafe generated
output.

## Suppression governance

Authored `oxlint-disable`/`eslint-disable` directives are an exact allowlist. Any addition, removal,
or move requires a reviewed contract change in `scripts/test-maintainability-lint.mjs`, and any
directive not on the list fails the gate:

| File                                         | Directive                                   | Reason                                                              |
| -------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------- |
| `packages/gen/src/helpers/templateEngine.ts` | `// oxlint-disable-next-line no-new-func`   | Template compilation evaluates generated template source by design. |
| `packages/server/src/lib/TypeweaverApp.ts`   | `// oxlint-disable import/max-dependencies` | The app composition root intentionally wires many collaborators.    |

The scanner distinguishes real directives from string literals, and unused-disable reporting means a
stale entry can never remain silent.

## Executable contracts

| Command                          | Contract it proves                                                                                                                            |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test:maintainability-lint` | Exact valid/invalid boundaries for the 10 maintainability rules, the allowlist scanner, and the no-ESLint runtime guard.                      |
| `pnpm test:lint-policy`          | 22 lint rules, test-scope enforcement, unused-disable reporting, `--deny-warnings`, and 9 configuration-weakening rejections.                 |
| `pnpm test:typescript-toolchain` | 20 compiler options and 18 diagnostics across the four compiler profiles.                                                                     |
| `pnpm test:quality-contracts`    | `typecheck:scripts` rejects an implicit-any tooling module and `test:tooling` rejects a broken build-config contract, using throwaway copies. |
| `pnpm typecheck:scripts`         | Checked JavaScript over every `scripts/**` and `config/tsdown/**` `.mjs` tooling file.                                                        |
| `pnpm test:tooling`              | The root tsdown build-config tests.                                                                                                           |
| `pnpm lint`                      | The full warning-free, type-aware policy over the repository.                                                                                 |

`pnpm verify:architecture-contracts` runs the compiler-profile, lint-policy, maintainability,
scripts-typecheck, root-tooling, and quality-task guards in a deterministic order alongside the
public contract and packed-consumer checks. The CI quality job runs `pnpm lint`,
`pnpm verify:architecture-contracts`, `pnpm docs:check`, `pnpm format:check`, and
`pnpm publish:dry`.

## Local commands

```sh
pnpm lint
pnpm test:maintainability-lint
pnpm test:lint-policy
pnpm test:typescript-toolchain
pnpm typecheck:scripts
pnpm test:tooling
pnpm test:quality-contracts
```
