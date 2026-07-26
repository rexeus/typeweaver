# @rexeus/typeweaver-command

Generate a Node.js command-line client from a TypeWeaver API contract. The plugin composes the
generated Fetch client from `@rexeus/typeweaver-clients`; it does not introduce a second HTTP
transport or authentication contract.

## Installation

Install the CLI and both generator plugins as development dependencies:

```bash
npm install -D \
  @rexeus/typeweaver \
  @rexeus/typeweaver-clients \
  @rexeus/typeweaver-command
```

Keep the ordinary generated-client runtime dependencies used by your project, including
`@rexeus/typeweaver-core` and `zod`.

## Generate

Select both `clients` and `command`. The command plugin declares the clients plugin as a dependency,
so plugin execution remains deterministic even when the order changes:

```bash
npx typeweaver generate \
  --input ./api/spec/index.ts \
  --output ./api/generated \
  --plugins clients,command
```

The generated output contains:

- `command/operations/<OperationId>Command.ts`, one adapter per operation
- `command/index.ts`, an import-safe barrel of operation adapters
- `command/cli.mts`, the executable Node.js entrypoint
- `lib/command`, the copied runtime needed by the generated program

Compile the generated `.ts` and `.mts` files with a NodeNext TypeScript configuration, then run the
emitted `.mjs` entrypoint:

```bash
node ./dist/api/generated/command/cli.mjs --help
```

The executable is deliberately excluded from generated barrels, so importing generated library code
never parses arguments or changes `process.exitCode`.

## Command contract

Operation IDs become deterministic kebab-case subcommands. Named request fields use these flags:

| Contract input | Generated flag                          | Values                    |
| -------------- | --------------------------------------- | ------------------------- |
| path field     | `--path-<field>`                        | one value                 |
| query field    | `--query-<field>`                       | repeat for array values   |
| header field   | `--header-<field>`                      | repeat for array values   |
| request body   | `--body`, `--body-file`, `--body-stdin` | choose at most one source |

When stdin is piped and no explicit body source is selected, the command reads the body from stdin.
JSON contracts decode the supplied text as JSON before the generated request validator runs. Other
body transports preserve the supplied text. Arbitrarily nested bodies are not flattened into
individual flags.

Provide the target through `--base-url` or `TYPEWEAVER_BASE_URL`:

```bash
TYPEWEAVER_BASE_URL=https://api.example.com \
  node ./dist/api/generated/command/cli.mjs \
  get-todo \
  --path-todo-id todo-1 \
  --auth-bearer-auth "$TOKEN" \
  --auth-api-key-auth "$API_KEY"
```

<!-- docs-example: generated-command -->

The public generated command types and invocation boundary are typechecked against the regenerated
integration project in the
[generated command fixture](../cli/examples/documentation/generated-command.ts).

## Security

Security flags are derived only from the normalized TypeWeaver contract:

- HTTP bearer, OAuth2, and OpenID Connect credentials become bearer authorization values.
- HTTP basic credentials are encoded as UTF-8 before Base64 conversion for the Basic authorization
  scheme.
- API keys are projected into their declared header, query, or cookie location.
- Requirements preserve contract semantics: schemes inside one requirement are ANDed; requirement
  entries are alternatives.

The runtime does not prompt for, persist, or echo credentials. Authentication provider login flows
and secret storage are outside this package.

## Output and exit codes

JSON is the default output for both success and failure. Pass `--human` for a stable concise
human-readable representation.

| Exit code | Meaning                                                     |
| --------- | ----------------------------------------------------------- |
| `0`       | successful response                                         |
| `2`       | command usage, missing option, or malformed body syntax     |
| `3`       | generated request validation failed                         |
| `4`       | the API returned an HTTP response with status 400 or higher |
| `5`       | the request failed at the network boundary                  |
| `6`       | sanitized internal failure                                  |
| `130`     | SIGINT cancellation                                         |

SIGINT aborts the shared generated Fetch request through `AbortSignal`; it does not create a second
request implementation.

## Validation limits

Path, query, and header inputs must be finite named object fields. Dynamic record/catch-all
containers cannot become deterministic flags and produce stable `TW-PLUGIN-COMMAND-*` validation
issues before generation. `help` is the only reserved command name; an API operation named `version`
is valid because the generated runtime has no conflicting version command. Command or flag
collisions also fail through the structured validation phase.

The generated executable currently targets Node.js. The ordinary TypeWeaver CLI and non-command
generated surfaces retain their documented Node.js, Deno, and Bun support.

## License

Apache 2.0 © Dennis Wentzien 2026
