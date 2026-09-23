# `@rexeus/typeweaver`

> The TypeWeaver command-line interface: scaffold a contract, validate it without writing, diagnose
> the project, and generate the surfaces your system needs.

[![npm version](https://img.shields.io/npm/v/@rexeus/typeweaver.svg)](https://www.npmjs.com/package/@rexeus/typeweaver)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](../../LICENSE)

## Choose this package when

Use `@rexeus/typeweaver` in every project that authors or generates a TypeWeaver contract. It is the
product entry point and includes the first-party projections.

You normally pair it with:

```bash
pnpm add -D @rexeus/typeweaver
pnpm add @rexeus/typeweaver-core zod
```

Add application runtime peers only for the integrations you use, such as `hono` or `effect`.

## Get a first success

```bash
pnpm dlx @rexeus/typeweaver init --target ./todo-api
cd todo-api
pnpm install
pnpm validate
pnpm generate
pnpm typecheck
```

The starter contains a complete Todo contract, five operations, reusable responses, a generation
config, and scripts for the normal development loop.

[Follow the complete walkthrough →](../../docs/getting-started.md)

## The normal workflow

```text
contract change
      ↓
typeweaver validate
      ↓
typeweaver generate
      ↓
tsc / tests / application implementation
```

Validate first in local development and CI. Generate only after the contract and every selected
projection agree that output can be published.

## Configuration

Create `typeweaver.config.mjs`:

```js
export default {
  input: "./api/spec/index.ts",
  output: "./api/generated",
  plugins: ["clients", "server", ["openapi", { target: "3.1.2" }]],
  format: true,
  clean: true,
};
```

<!-- docs-example: generation-cli-config -->

The complete configuration shape is checked in the
[CLI configuration fixture](./examples/documentation/typeweaver.config.mjs).

Then run:

```bash
pnpm typeweaver generate --config ./typeweaver.config.mjs
```

Configuration files must be JavaScript modules: `.js`, `.mjs`, or `.cjs`. The loader accepts either
a default export or a named `config` export.

| Key       | Meaning                                               | Default                                    |
| --------- | ----------------------------------------------------- | ------------------------------------------ |
| `input`   | Spec entrypoint                                       | required unless provided by a command flag |
| `output`  | Generated output directory                            | required for generation                    |
| `plugins` | Plugin names or `[name, options]` tuples              | only the always-on `types` projection      |
| `format`  | Format generated TypeScript with oxfmt when available | `true`                                     |
| `clean`   | Replace stale generated output                        | `true`                                     |

Custom top-level keys are preserved and exposed to plugins through `context.config`.

CLI values override config values. In particular, `--plugins` replaces the configured list for that
invocation.

## Commands

| Command                 | Purpose                                               | Writes generated output?       |
| ----------------------- | ----------------------------------------------------- | ------------------------------ |
| `typeweaver init`       | Create the maintained Todo starter                    | creates starter files          |
| `typeweaver validate`   | Bundle, normalize, and run plugin validation          | no                             |
| `typeweaver generate`   | Validate and publish generated surfaces               | yes                            |
| `typeweaver doctor`     | Diagnose runtime, config, plugin, and output problems | no                             |
| `typeweaver add plugin` | Scaffold a third-party plugin project                 | creates a new plugin directory |

### `generate`

```bash
pnpm typeweaver generate \
  --input ./api/spec/index.ts \
  --output ./api/generated \
  --plugins clients,server,openapi
```

Common options:

| Option                     | Description                                                      |
| -------------------------- | ---------------------------------------------------------------- |
| `--input, -i <path>`       | Spec entrypoint                                                  |
| `--output, -o <path>`      | Generated output directory                                       |
| `--config, -c <path>`      | JavaScript config file                                           |
| `--plugins, -p <names>`    | Comma-separated plugin selection                                 |
| `--format` / `--no-format` | Enable or disable formatting                                     |
| `--clean` / `--no-clean`   | Enable or disable output cleanup                                 |
| `--check`                  | Generate in isolation and report drift without writing output    |
| `--verbose`                | Show plugin loading, lifecycle, locking, and Effect span details |

Generation uses a per-call plugin registry, validates before write-capable publication, protects
generated paths, and publishes files through the generator context rather than arbitrary plugin
writes.

#### Check committed output in CI

`generate --check` performs a fresh isolated generation in OS temporary storage and byte-compares it
with the configured output. It exits `0` only when the committed tree is current and `1` when it has
drifted, reporting sorted `Added`, `Removed`, and `Changed` relative paths. The configured output is
never created, cleaned, or written, so the check is safe for read-only CI jobs and honors both the
config and explicit-option workflows.

<!-- docs-example: generate-check-workflow -->

```json
{
  "scripts": {
    "api:check": "typeweaver generate --check --config ./typeweaver.config.mjs"
  }
}
```

```yaml
# .github/workflows/api.yml
- run: pnpm install --frozen-lockfile
- run: pnpm api:check
```

The check mirrors `generate` configuration, including `format`, `plugins`, and `clean`. With
`clean: false` it snapshots the committed output into the isolated stage before generating, so
preserved files are not reported as drift. Pass `--verbose` to keep the usual debug lock and
lifecycle output.

The generation lock is a flat `.typeweaver-output-lock-<hash>` entry directly under a verified
trusted system temp directory, and staging directories are created there too, so no artifact is
written into the configured output and no user owns a shared parent. The lock identity realpath- and
case-folds the physical output path, so a missing output and its later-created form share one lock.
Checks resolve bare spec imports from the original `<output>/spec/spec.js` location before isolated
evaluation, so dependency fallback matches normal generation without allowing the shared temp
directory to inject packages. Non-literal dynamic imports cannot be pinned safely and are rejected
during isolated evaluation. A configured output or project directory that equals the temp root or
uses a reserved coordination/staging name is rejected before anything is created; ordinary outputs
elsewhere under the temp root are unaffected. A normal clean removes a proven dead legacy lock and
ordinary lookalikes while preserving a live proven lock. Do not run generation concurrently with a
CLI version that predates this lock location; a live, malformed (including symlinked metadata), or
ownership-uncertain legacy `.typeweaver-lock` fails closed and requires manual review. See
[MIGRATION.md](../../MIGRATION.md).

### `validate`

```bash
pnpm typeweaver validate --config ./typeweaver.config.mjs
pnpm typeweaver validate --config ./typeweaver.config.mjs --strict
pnpm typeweaver validate --config ./typeweaver.config.mjs --json
```

Validation does not publish the configured output directory. It returns normalization issues and
projection-specific diagnostics from every selected plugin.

The default failure threshold is `error`.

| Option              | Effect                                           |
| ------------------- | ------------------------------------------------ |
| `--fail-on error`   | fail only on errors; default                     |
| `--fail-on warning` | fail on warnings and errors                      |
| `--fail-on info`    | fail on any reported issue                       |
| `--strict`          | shorthand for `--fail-on warning`                |
| `--json`            | write one versioned `ValidationReport` to stdout |

Exit code `0` means no issue met the threshold. Exit code `1` means at least one did.

<!-- docs-example: validate-workflow -->

The package exports `ValidationReportSchema` and related schemas for automation:

```ts
import { ValidationReportSchema } from "@rexeus/typeweaver";

const report = ValidationReportSchema.parse(JSON.parse(stdout));
```

### `doctor`

```bash
pnpm typeweaver doctor --config ./typeweaver.config.mjs --deep
pnpm typeweaver doctor --config ./typeweaver.config.mjs --deep --json
```

Doctor checks runtime detection, the repository's Node.js 24 reference environment, config and spec
resolution, plugin availability, output safety and permissions, the supported Effect range, and
optional formatting support. `--deep` also bundles, normalizes, and validates the contract.

Doctor never publishes generated output. Warnings are advisory; failed checks exit `1`.

<!-- docs-example: doctor-workflow -->

The package exports `DoctorReportSchema` for machine-readable output.

### `init`

```bash
pnpm typeweaver init --target ./todo-api
pnpm typeweaver init --target ./todo-api --dry-run
pnpm typeweaver init --target ./todo-api --config-format cjs
```

<!-- docs-example: init-workflow -->

The command refuses a non-empty target unless `--force` is present. Force mode replaces only
conflicting starter files and attempts to restore all published files if a later publication fails.

Use `--json` for one versioned `InitReport`. The package exports `InitReportSchema` for automation.

### `add plugin`

```bash
pnpm typeweaver add plugin \
  --name audit-log \
  --target ./typeweaver-plugin-audit-log
```

<!-- docs-example: plugin-scaffold -->

Plugin names use lowercase kebab-case. The target must not already exist. The scaffold includes a
strict TypeScript setup, a configurable plugin export, a generation fixture, and tests built on the
public plugin test kit.

[Read the plugin authoring guide →](../../docs/plugin-authoring.md)

## First-party projections

| Name      | Package reference                            | Output                                                |
| --------- | -------------------------------------------- | ----------------------------------------------------- |
| `types`   | [`typeweaver-types`](../types/README.md)     | request/response types and validators; always enabled |
| `clients` | [`typeweaver-clients`](../clients/README.md) | Fetch clients and request commands                    |
| `command` | [`typeweaver-command`](../command/README.md) | Node.js command-line client; depends on `clients`     |
| `server`  | [`typeweaver-server`](../server/README.md)   | Fetch-native routers, handlers, and middleware        |
| `hono`    | [`typeweaver-hono`](../hono/README.md)       | Hono routers and handler contracts                    |
| `effect`  | [`typeweaver-effect`](../effect/README.md)   | Effect adapters; depends on `server`                  |
| `openapi` | [`typeweaver-openapi`](../openapi/README.md) | OpenAPI JSON document                                 |
| `aws-cdk` | [`typeweaver-aws-cdk`](../aws-cdk/README.md) | API Gateway HTTP API route helpers                    |

Plugin dependencies are ordered by the generator. You do not need to arrange `server` before
`effect` or `clients` before `command` manually.

<!-- docs-example: generated-command -->

The generated command library boundary is typechecked in the
[command fixture](./examples/documentation/generated-command.ts).

## Spec loading

TypeWeaver bundles one configured spec entrypoint. The module may expose:

- a default spec export;
- a named `spec` export;
- the spec value as the module namespace.

Folder names are not part of the contract. Resource names come from
`defineSpec({ resources: ... })`, and operations may be organized across any local files imported by
the entrypoint.

## Runtime notes

The repository's reference workflow and doctor checks target Node.js 24. The CLI is also exercised
through Deno and Bun entrypoints, but generated runtime support depends on the selected package. The
generated `command` executable is Node.js-specific.

Use the package through the runner for your environment:

```bash
# Node.js
npx @rexeus/typeweaver generate --config ./typeweaver.config.mjs
pnpm dlx @rexeus/typeweaver generate --config ./typeweaver.config.mjs

# Deno
deno run -A --sloppy-imports npm:@rexeus/typeweaver generate \
  --config ./typeweaver.config.mjs

# Bun
bunx @rexeus/typeweaver generate --config ./typeweaver.config.mjs
```

When the package is installed locally, `pnpm typeweaver`, `npx typeweaver`, and `bunx typeweaver`
resolve its `typeweaver` binary directly.

## Programmatic exports

Importing `@rexeus/typeweaver` is side-effect free: it does not parse arguments or mutate
`process.exitCode`. The package exports the production generator service/runtime plus versioned
report schemas and types.

## Effect 4 native runtime

The CLI programmatic API (`Generator`, `effectRuntime`), generator lifecycle, first-party generator
packages (including `command`, `hono`, and `openapi`), and the Effect adapter share the exact
`effect@4.0.0-rc.116` runtime identity. `typeweaver doctor` checks the project declaration as
`TW-DOCTOR-011` and the CLI's own runtime as `TW-DOCTOR-008`.

The CLI imports its first-party generators from its own dependency tree, so the CLI-hosted
`command`, `hono`, and `openapi` generators run on the CLI's exact Effect and need no project
Effect. `TW-DOCTOR-011` therefore fails only when the `effect` projection or a custom plugin is
configured and the project does not resolve its own `effect@4.0.0-rc.116`. Without those plugins, a
project that does not declare Effect is skipped, and a project on another Effect version gets a
warning.

Core authoring and generated plain outputs remain Effect-optional because generated modules do not
import Effect. This output claim does not make the generator packages optional: the command and
OpenAPI packages import Effect directly. The migration changes visible Effect APIs including
`Context.Service`, `Result`, `Cause`, Schema decoding, and the native CLI; see
[ADR 0008](../../docs/adr/0008-effect-4-baseline.md), the [migration guide](../../MIGRATION.md), and
the [plugin authoring guide](../../docs/plugin-authoring.md).

## Related documentation

- [Getting started](../../docs/getting-started.md)
- [Contract authoring](../core/README.md)
- [Generation and plugin SDK](../gen/README.md)
- [Project vision](../../VISION.md)
- [Migration guide](../../MIGRATION.md)

## License

Apache 2.0 © Dennis Wentzien 2026
