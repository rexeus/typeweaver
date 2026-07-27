# `@rexeus/typeweaver-command`

> Generate a deterministic Node.js command-line client from the same operations, request schemas,
> security declarations, and response contract as your application client.

[![npm version](https://img.shields.io/npm/v/@rexeus/typeweaver-command.svg)](https://www.npmjs.com/package/@rexeus/typeweaver-command)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](../../LICENSE)

## Choose this projection when

Use `command` when operators, scripts, CI jobs, or support teams need a stable executable interface
to your API without maintaining a separate CLI contract.

The generated program composes the generated Fetch client. It does not introduce another transport,
another authentication model, or another response parser.

## Generate it

Install the TypeWeaver product and ordinary generated-client runtime dependencies:

```bash
pnpm add -D @rexeus/typeweaver typescript
pnpm add @rexeus/typeweaver-core zod
```

Select `clients` and `command`:

```bash
pnpm typeweaver generate \
  --input ./api/spec/index.ts \
  --output ./api/generated \
  --plugins clients,command
```

The command plugin declares its dependency on `clients`, so lifecycle ordering remains deterministic
even when the configured list changes.

## Generated surface

```text
api/generated/
├── command/
│   ├── operations/
│   │   ├── GetTodoCommand.ts
│   │   └── CreateTodoCommand.ts
│   ├── index.ts
│   └── cli.mts
└── lib/
    ├── clients/
    └── command/
```

- `command/operations/<OperationId>Command.ts` adapts one generated request command to CLI input.
- `command/index.ts` is an import-safe library barrel.
- `command/cli.mts` is the executable entrypoint.
- `lib/command` contains the copied runtime.

The executable is deliberately excluded from generated barrels. Importing generated library code
never parses arguments or changes `process.exitCode`.

## Compile and run

Compile generated `.ts` and `.mts` files with a NodeNext TypeScript configuration. Then run the
emitted `.mjs` entrypoint:

```bash
node ./dist/api/generated/command/cli.mjs --help
```

Every operation ID becomes a deterministic kebab-case subcommand. For example, `getTodo` becomes
`get-todo`:

```bash
TYPEWEAVER_BASE_URL=https://api.example.com \
  node ./dist/api/generated/command/cli.mjs \
  get-todo \
  --path-todo-id 846a8c8d-28dc-4b66-ae6c-8d1c551430b2
```

You may provide the target through `--base-url` instead of `TYPEWEAVER_BASE_URL`.

<!-- docs-example: generated-command -->

The import-safe generated command boundary is typechecked in the
[command fixture](../cli/examples/documentation/generated-command.ts).

## Request flags

| Contract input     | Generated flag     | Value behavior             |
| ------------------ | ------------------ | -------------------------- |
| path field         | `--path-<field>`   | one value                  |
| query field        | `--query-<field>`  | repeat for array values    |
| header field       | `--header-<field>` | repeat for array values    |
| request body       | `--body`           | inline text or JSON        |
| request body file  | `--body-file`      | read from a file           |
| request body stdin | `--body-stdin`     | read explicitly from stdin |

Select at most one body source. When stdin is piped and no explicit body source is selected, the
generated command reads the body from stdin automatically.

JSON bodies are parsed before the generated request validator runs. Other body transports preserve
the supplied text. Nested request bodies are intentionally not flattened into dozens of flags.

## Security flags

Security options are derived from the normalized contract:

- HTTP bearer, OAuth 2, and OpenID Connect credentials become bearer authorization values.
- HTTP basic credentials are UTF-8 encoded before Base64 conversion.
- API keys are projected into their declared header, query, or cookie location.
- Schemes inside one requirement are required together; requirement entries are alternatives.

Example:

```bash
node ./dist/api/generated/command/cli.mjs get-account \
  --base-url https://api.example.com \
  --auth-bearer-auth "$TOKEN" \
  --auth-api-key-auth "$API_KEY"
```

The runtime does not prompt for, persist, refresh, or echo credentials. Authentication-provider
login flows and secret storage remain outside this package.

## Output

JSON is the default for both success and failure. Pass `--human` for a concise human-readable
representation.

Declared API responses stay distinct from command and transport failures. Automation can therefore
inspect both the process exit code and the structured output.

## Exit codes

|  Code | Meaning                                                     |
| ----: | ----------------------------------------------------------- |
|   `0` | successful API response                                     |
|   `2` | usage error, missing option, or malformed body syntax       |
|   `3` | generated request validation failed                         |
|   `4` | the API returned an HTTP response with status 400 or higher |
|   `5` | network request failed                                      |
|   `6` | sanitized internal failure                                  |
| `130` | SIGINT cancellation                                         |

SIGINT aborts the same generated Fetch request used by the application client.

## Shapes that can become commands

Path, query, and header inputs must be finite named object fields. Dynamic record/catch-all
containers cannot become deterministic flags and produce stable `TW-PLUGIN-COMMAND-*` validation
issues before generation.

Generation also rejects command or flag collisions. `help` is reserved; an operation named `version`
remains valid because the generated runtime does not create a conflicting version command.

## Runtime boundary

The generated executable targets Node.js. Other TypeWeaver projections retain their own documented
runtime support.

## Boundaries

This plugin does not:

- create an interactive terminal UI;
- flatten arbitrary nested body schemas into flags;
- manage tokens or credentials;
- define a second API client;
- turn undeclared HTTP responses into successful output.

## Related documentation

- [Migration guide](../../MIGRATION.md)
- [Fetch clients](../clients/README.md)
- [CLI and generation](../cli/README.md)
- [Contract security declarations](../core/README.md#security-declarations)
- [Getting started](../../docs/getting-started.md)

## License

Apache 2.0 © Dennis Wentzien 2026
