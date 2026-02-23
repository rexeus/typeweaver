# test-utils

Internal test utilities for the typeweaver monorepo. This package is **not published to npm** — it
is used exclusively by other packages for integration and unit testing.

## What's inside

### Test Project (`src/test-project/`)

A complete sample API project with definitions, generated output, and typed schemas:

- **Definitions** — API contracts for `Todo`, `Account`, `Auth` resources with shared error
  responses, demonstrating all typeweaver features (path params, query params, headers, bodies,
  error types, nested resources like SubTodos)
- **Generated Output** — Pre-generated code from the definitions using all plugins (`clients`,
  `hono`, `server`, `aws-cdk`), providing real generated artifacts for testing

### Test Data Factories (`src/data/`)

Composable factory functions for creating test request/response objects with sensible defaults:

- `createData(defaults, overrides)` — Deep-merges defaults with partial overrides
- `createDataFactory(getDefaults)` — Creates reusable factories from a defaults function
- `createRequest(...)` — Builds typed `IHttpRequest` objects with body/header/param/query creators
- `createResponse(...)` — Builds typed `IHttpResponse` objects with body/header creators
- `createErrorResponseHeader()` — Factory for error response headers
- `createJwtToken()` — Generates fake JWT tokens for auth testing

Per-resource utilities (e.g., `createGetTodoRequest()`, `createAccessTokenResponse()`) are generated
and provide ready-to-use test data for every operation.

### Test Servers (`src/test-server/`)

Pre-configured server instances for integration testing:

- `createTestServer(options)` — Starts a Hono-based HTTP server on a random port with all routers
  mounted
- `createPrefixedTestServer(prefix, options)` — Same, but with routes under a path prefix
- `createTestApp(options)` — Creates a `TypeweaverApp` (server plugin) instance for direct
  `fetch()` testing without starting an HTTP server
- `createTestHono(options)` — Creates a Hono app instance for direct testing

All test server functions support options to force handler errors (`throwTodoError`,
`throwAuthError`, etc.) and override responses (`customResponses`) for testing error handling
scenarios.

### Utilities

- `captureError(fn)` — Captures a synchronous error for assertion without `expect().toThrow()`

## Usage

Referenced from other packages via `"test-utils": "file:../test-utils"` in their `devDependencies`.

```ts
import {
  createTestServer,
  createTestApp,
  createGetTodoRequest,
  createGetTodoSuccessResponse,
  captureError,
} from "test-utils";
```

## Regenerating Test Output

When definitions or plugins change, regenerate the test output:

```bash
pnpm --filter test-utils run test-project:gen
```

## License

Apache 2.0 © Dennis Wentzien 2025
