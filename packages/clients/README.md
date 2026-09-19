# `@rexeus/typeweaver-clients`

> Generate a typed Fetch client whose requests and response unions come directly from the same
> executable contract as your server and documentation.

[![npm version](https://img.shields.io/npm/v/@rexeus/typeweaver-clients.svg)](https://www.npmjs.com/package/@rexeus/typeweaver-clients)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](../../LICENSE)

## Choose this projection when

Use `clients` for application code, integration tests, SDK-style consumers, or any other TypeScript
caller that should not rebuild HTTP paths and response shapes by hand.

The first-party plugin ships with the TypeWeaver CLI:

```bash
pnpm add -D @rexeus/typeweaver
pnpm add @rexeus/typeweaver-core zod
```

Generate it:

```bash
pnpm typeweaver generate \
  --input ./api/spec/index.ts \
  --output ./api/generated \
  --plugins clients
```

Or select it in `typeweaver.config.mjs`:

```js
export default {
  input: "./api/spec/index.ts",
  output: "./api/generated",
  plugins: ["clients"],
};
```

## Generated surface

For every resource, TypeWeaver emits one client. For every operation, it emits one request command:

```text
api/generated/todo/
├── TodoClient.ts
├── CreateTodoRequestCommand.ts
├── GetTodoRequestCommand.ts
└── ...types and validators from the automatic types projection
```

The resource client owns transport configuration. Each command owns one operation's method, path,
request shape, request validation, and response processing.

## Call an operation

```ts
import { GetTodoRequestCommand, TodoClient } from "./api/generated/index.js";

const client = new TodoClient({
  baseUrl: "https://api.example.com",
});

const response = await client.send(
  new GetTodoRequestCommand({
    param: {
      todoId: "846a8c8d-28dc-4b66-ae6c-8d1c551430b2",
    },
  })
);

switch (response.type) {
  case "GetTodoSuccess":
    console.log(response.body.title);
    break;

  case "TodoNotFound":
    console.error(response.body.message);
    break;
}
```

<!-- docs-example: generated-client -->

The generated client and request-command boundary is typechecked in the
[client fixture](../cli/examples/documentation/generated-client.ts).

`send()` returns the complete generated response union. Narrow on `response.type`; do not cast a raw
status/body pair into an application type.

## Client options

```ts
const client = new TodoClient({
  baseUrl: "https://api.example.com",
  fetchFn: instrumentedFetch,
  defaultHeaders: {
    Authorization: `Bearer ${token}`,
  },
  defaultQuery: {
    apiVersion: "2026-07-01",
  },
  signal: shutdownController.signal,
  timeoutMs: 30_000,
});
```

| Option           | Behavior                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| `baseUrl`        | Required non-empty base URL; an explicit URI scheme must be HTTP or HTTPS                          |
| `fetchFn`        | Custom Fetch implementation; defaults to `globalThis.fetch`                                        |
| `defaultHeaders` | Copied into every request unless the command supplies the same header, compared case-insensitively |
| `defaultQuery`   | Copied into every request unless the command supplies the same query key                           |
| `signal`         | External cancellation boundary                                                                     |
| `timeoutMs`      | Positive finite timeout; combined with `signal` when both exist                                    |

The supplied default objects are not mutated.

## Request behavior

The generated client:

- validates command input through the generated request validator;
- substitutes and URL-encodes declared `:path` parameters;
- rejects missing, unexpected, or unsafe dot-segment path values;
- serializes query arrays as repeated values;
- preserves strings and native Fetch body types;
- JSON-serializes other supported body values;
- adds `Content-Type: application/json` only when it performed JSON serialization and no content
  type was supplied.

## Response behavior

The transport parses the body according to the response content type:

- JSON and `+json` media types become parsed values;
- text or missing content types become strings;
- other media types become `ArrayBuffer` values;
- `204` and `304` responses have no body.

The generated command then validates the raw response against every response declared for the
operation.

A matching response is returned as the typed discriminated union. A response that matches no
declared status/schema combination throws `UnknownResponseError` rather than being accepted as an
invented variant.

Unknown object keys may be removed when the declared Zod object schema parses the response. That is
normal schema parsing; it is different from accepting an unrecognized response.

## Failure boundary

Transport and contract failures remain distinguishable:

| Error                         | Meaning                                                                     |
| ----------------------------- | --------------------------------------------------------------------------- |
| `ApiClientConfigurationError` | Invalid base URL or timeout configuration                                   |
| `PathParameterError`          | Missing, unexpected, or unsafe path parameter                               |
| `NetworkError`                | Fetch failed, timed out, or was aborted                                     |
| `ResponseParseError`          | The response body could not be read or parsed as declared by its media type |
| `RequestValidationError`      | Command input did not satisfy the generated request contract                |
| `UnknownResponseError`        | The HTTP response matched none of the operation's declared responses        |

This separation lets application code retry network failures, report contract drift, and handle
declared API responses without conflating them.

## Custom Fetch for middleware and tests

```ts
const client = new TodoClient({
  baseUrl: "https://api.example.com",

  fetchFn: async (input, init) => {
    const startedAt = performance.now();

    try {
      return await fetch(input, init);
    } finally {
      console.log("request duration", performance.now() - startedAt);
    }
  },
});
```

The custom function is the single transport boundary; request commands do not create another HTTP
implementation.

## Boundaries

This plugin does not:

- perform an OAuth login flow or store secrets;
- retry requests automatically;
- hide undeclared server responses;
- generate a command-line program — use [`command`](../command/README.md) for that;
- require a TypeWeaver server. It can call any endpoint that honors the declared HTTP contract.

## Related documentation

- [Migration guide](../../MIGRATION.md)
- [Getting started](../../docs/getting-started.md)
- [Generated types and validators](../types/README.md)
- [Generated command-line client](../command/README.md)
- [Contract authoring](../core/README.md)

## License

Apache 2.0 © Dennis Wentzien 2026
