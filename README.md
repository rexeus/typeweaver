<div align="center">

# 🧵 TypeWeaver

### One contract. Every surface. No drift.

Define your HTTP API once in TypeScript and Zod. Generate the typed clients, validated server
boundaries, command-line tools, infrastructure routes, and OpenAPI documents your team would
otherwise keep in sync by hand.

[Get started](./docs/getting-started.md) · [Browse the documentation](./docs/README.md) ·
[Choose a projection](#choose-the-surfaces-you-need) · [Build a plugin](./docs/plugin-authoring.md)
· [Read the vision](./VISION.md)

</div>

---

## Your API should not become a coordination problem

A single endpoint often ends up described in several places: backend validators, handler types,
frontend clients, API documentation, infrastructure, and operational tooling. Every copy can drift.
Every change becomes a search-and-update exercise.

TypeWeaver replaces those parallel contracts with one executable source:

```text
TypeScript + Zod contract
          │
          ├── validate and normalize
          │
          ├── TypeScript types and Zod validators
          ├── Fetch clients
          ├── Fetch-native or Hono server routers
          ├── a Node.js command-line client
          ├── OpenAPI documents
          └── AWS CDK route helpers
```

Change the contract. Regenerate. Let TypeScript, runtime validation, and stable diagnostics show you
every surface that moved.

## See the loop

Your contract stays readable TypeScript:

```ts
import {
  defineOperation,
  defineResponse,
  defineSpec,
  HttpMethod,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { z } from "zod";

const GetTodoSuccess = defineResponse({
  name: "GetTodoSuccess",
  statusCode: HttpStatusCode.OK,
  description: "The todo was found",
  body: z.object({
    id: z.uuid(),
    title: z.string(),
    completed: z.boolean(),
  }),
});

const GetTodo = defineOperation({
  operationId: "getTodo",
  method: HttpMethod.GET,
  path: "/todos/:todoId",
  summary: "Get a todo",
  request: {
    param: z.object({
      todoId: z.uuid(),
    }),
  },
  responses: [GetTodoSuccess],
});

export const spec = defineSpec({
  metadata: {
    title: "Todo API",
    version: "1.0.0",
  },
  resources: {
    todo: {
      operations: [GetTodo],
    },
  },
});
```

<!-- docs-example: root-quickstart -->

The complete contract shape is typechecked in the
[root quickstart fixture](./packages/cli/examples/documentation/root-quickstart.ts).

Then choose the surfaces your project needs:

```js
// typeweaver.config.mjs
export default {
  input: "./api/spec/index.ts",
  output: "./api/generated",
  plugins: ["clients", "server", "openapi"],
};
```

The generated client already understands the request and every declared response:

<!-- docs-example: generated-client -->

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

if (response.type === "GetTodoSuccess") {
  console.log(response.body.title); // fully typed
}
```

<!-- docs-snippet: root-generated-client -->

This visible block is synchronized with the
[root client snippet](./packages/cli/examples/documentation/snippets/root-generated-client.ts) and
typechecked against freshly generated output from the documented Todo contract.

No handwritten DTO mirror. No separate client contract. No documentation schema to remember after
the implementation changes.

## Start with a working API contract

```bash
pnpm dlx @rexeus/typeweaver init --target ./todo-api
cd todo-api
pnpm install
pnpm validate
pnpm generate
pnpm typecheck
```

<!-- docs-example: init-workflow -->

The starter gives you a complete Todo contract, reusable responses, a generation config, and a
repeatable validate → generate → typecheck workflow.

[Walk through the generated project →](./docs/getting-started.md)

## Choose the surfaces you need

The `types` projection is always included. Add only the capabilities that belong in your system:

| You need                            | Select               | What you get                                                                            |
| ----------------------------------- | -------------------- | --------------------------------------------------------------------------------------- |
| A typed application client          | `clients`            | Resource clients and one request command per operation, built on Fetch                  |
| A portable request-handler boundary | `server`             | Generated routers, typed handlers, validation, and middleware over `Request`/`Response` |
| Hono integration                    | `hono`               | Generated Hono routers wired to the same contract                                       |
| An operator-facing CLI              | `clients`, `command` | One deterministic subcommand per API operation                                          |
| Effect-returning handlers           | `server`, `effect`   | Effect adapters over the Fetch-native server contract                                   |
| Standards-based API documentation   | `openapi`            | Generates validated OpenAPI 3.1.2 and 3.2.0 JSON documents                              |
| API Gateway route declarations      | `aws-cdk`            | AWS CDK HTTP API route helpers while integration ownership stays in your stack          |

<!-- docs-example: generated-command -->

The generated command invocation boundary is typechecked in the
[command fixture](./packages/cli/examples/documentation/generated-command.ts).

## Built for contract evolution

TypeWeaver is designed around a few non-negotiable properties:

- **One validated core.** Every plugin consumes the same normalized contract.
- **Deterministic output.** The same contract and configuration should produce the same files.
- **Explicit projection loss.** A target that cannot faithfully represent part of the contract
  reports a diagnostic instead of silently inventing behavior.
- **Generated code you can own operationally.** Framework-specific integrations are optional; the
  Fetch-native path remains the portable baseline.
- **A public extension model.** Third-party plugins use documented lifecycle, context, diagnostics,
  and testing contracts.

## Where to go next

- [Getting started](./docs/getting-started.md) — build, generate, call, serve, and evolve a small
  API.
- [Documentation index](./docs/README.md) — find contract, CLI, projection, plugin, runtime,
  troubleshooting, and migration guidance.
- [CLI reference](./packages/cli/README.md) — `init`, `validate`, `generate`, `doctor`,
  configuration, and automation.
- [Contract authoring](./packages/core/README.md) — specs, operations, responses, metadata, and
  security declarations.
- [Plugin authoring](./docs/plugin-authoring.md) — create a new projection on the normalized model.
- [Vision](./VISION.md) — product promise, principles, boundaries, and non-goals.

## Package map

### Product entry point

- [`@rexeus/typeweaver`](./packages/cli/README.md) — scaffold, validate, diagnose, and generate.

### Contract and generated surfaces

- [`@rexeus/typeweaver-core`](./packages/core/README.md) — executable contract and shared runtime
  types.
- [`@rexeus/typeweaver-types`](./packages/types/README.md) — generated request/response types and
  validators; always enabled.
- [`@rexeus/typeweaver-clients`](./packages/clients/README.md) — generated Fetch clients.
- [`@rexeus/typeweaver-command`](./packages/command/README.md) — generated Node.js command-line
  client.
- [`@rexeus/typeweaver-server`](./packages/server/README.md) — Fetch-native server routers and
  middleware.
- [`@rexeus/typeweaver-hono`](./packages/hono/README.md) — Hono routers.
- [`@rexeus/typeweaver-effect`](./packages/effect/README.md) — optional Effect handler adapters.
- [`@rexeus/typeweaver-openapi`](./packages/openapi/README.md) — OpenAPI projection.
- [`@rexeus/typeweaver-aws-cdk`](./packages/aws-cdk/README.md) — AWS CDK HTTP API route helpers.

### Extension and schema tooling

- [`@rexeus/typeweaver-gen`](./packages/gen/README.md) — normalized model, plugin lifecycle,
  contexts, and test kit.
- [`@rexeus/typeweaver-zod-to-ts`](./packages/zod-to-ts/README.md) — Zod-to-TypeScript projection.
- [`@rexeus/typeweaver-zod-to-json-schema`](./packages/zod-to-json-schema/README.md) —
  Zod-to-JSON-Schema projection.
- [`test-utils`](./packages/test-utils/README.md) — private monorepo fixtures and integration
  helpers.

## Project status

TypeWeaver is pre-1.0 and under active development. Public contracts may still change before 1.0;
breaking changes are documented through Changesets and migration guidance.

The repository's reference workflow targets Node.js 24. Runtime support depends on the generated
surface: consult the relevant package page before choosing a deployment target. The generated
command-line client is Node.js-specific.

## Contributing and feedback

Contributions to documentation, examples, bug fixes, plugins, and product features are welcome. Use
[GitHub Issues](https://github.com/rexeus/typeweaver/issues) for defects, documentation gaps, and
product ideas.

## License

Apache 2.0 © Dennis Wentzien 2026
