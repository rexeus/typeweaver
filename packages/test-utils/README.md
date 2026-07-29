# `test-utils`

> Private fixtures, factories, generated artifacts, and test servers used to verify TypeWeaver
> packages against one representative API contract.

## Internal workspace only

This workspace is private and is not published to npm. It exists for TypeWeaver repository
maintainers and package tests.

Application users and third-party plugin authors should not depend on it. Plugin authors can use the
public [`createPluginTestKit`](../gen/README.md#test-the-public-lifecycle-in-memory) instead.

## What it contains

### Representative test project

`src/test-project/` contains a complete API contract with Todo, Account, Auth, and nested resource
scenarios. It exercises:

- path, query, header, and body inputs;
- reusable and inline responses;
- success and error unions;
- security and authentication-related shapes;
- generated output from every first-party projection.

The checked-in output lets package tests import real generated files without rebuilding the project
in every test process.

### Data factories

`src/data/` provides composable defaults and overrides for request and response fixtures, including:

- `createData()`;
- `createDataFactory()`;
- request and response builders;
- generated operation-specific factories;
- common error headers;
- fake JWT values for authentication scenarios.

Prefer these factories over large handwritten objects so a contract change can be reflected in one
place.

### Test applications and servers

`src/test-server/` provides:

- a Hono HTTP server on a random port;
- a prefixed server variant;
- a `TypeweaverApp` for direct `fetch()` tests;
- a Hono app for direct adapter tests;
- handler-error and response-override controls for boundary testing.

Use direct app calls when networking is not part of the behavior under test. Start a real server
only for end-to-end HTTP behavior.

### Small assertion helpers

The workspace also exports focused helpers such as `captureError()` for tests that need to inspect a
synchronously thrown value.

## Usage inside the monorepo

Packages reference the workspace through a local development dependency:

```json
{
  "devDependencies": {
    "test-utils": "file:../test-utils"
  }
}
```

```ts
import {
  captureError,
  createGetTodoRequest,
  createGetTodoSuccessResponse,
  createTestApp,
  createTestServer,
} from "test-utils";
```

Keep imports on the public workspace barrel unless a test is deliberately exercising an internal
fixture module.

## Regenerate checked-in output

Regenerate whenever the contract, normalized model, templates, public generated API, or any
first-party plugin changes:

```bash
pnpm --filter test-utils run test-project:gen
```

The script runs the TypeWeaver CLI with:

```text
clients, command, aws-cdk, hono, server, effect, openapi
```

The automatic `types` projection is included as their shared foundation.

After regeneration, inspect the diff. Generated changes are part of the review signal: unexpected
churn can reveal an unstable emitter or an accidental public API change.

## Maintenance rules

- Keep the fixture broad enough to exercise shared behavior, but do not turn it into product
  documentation.
- Add a focused package-local test for edge cases that do not belong in the representative API.
- Do not publish this workspace or treat its helpers as compatibility contracts.
- Keep generated output synchronized with the source fixture.
- Prefer the public plugin test kit for third-party extension examples.

## Related documentation

- [Plugin SDK](../gen/README.md)
- [CLI reference](../cli/README.md)
- [Repository Getting Started](../../docs/getting-started.md)

## License

Apache 2.0 © Dennis Wentzien 2026
