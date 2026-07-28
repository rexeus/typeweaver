# Getting started with TypeWeaver

This guide takes one small HTTP contract from an empty directory to generated types, a working Fetch
client, a typed server boundary, and an OpenAPI document.

The goal is not to teach every option. It is to make the TypeWeaver development loop tangible:

```text
author → validate → generate → implement → consume → evolve
```

## What you need

This walkthrough uses:

- Node.js 24
- pnpm
- TypeScript
- Zod 4

The repository also exercises selected generated bundles with Deno and Bun. Runtime support is
projection-specific, so check the package README for the surface you plan to deploy.

## Fastest path: scaffold the starter

Create the maintained Todo example:

```bash
pnpm dlx @rexeus/typeweaver init --target ./todo-api
cd todo-api
pnpm install
pnpm validate
pnpm generate
pnpm typecheck
```

<!-- docs-example: init-workflow -->

The starter contains:

```text
api/
├── spec/                 # the source contract
│   ├── index.ts
│   ├── shared/
│   └── todo/
└── generated/            # generated output; do not edit by hand

typeweaver.config.mjs
package.json
```

Open `api/spec/` first. The folder layout is only an organizational choice; TypeWeaver reads the
spec entrypoint configured in `typeweaver.config.mjs`.

Run these commands whenever you change the contract:

```bash
pnpm validate
pnpm generate
pnpm typecheck
```

Use `pnpm doctor` when the project, runtime, config, plugin resolution, or output directory does not
behave as expected.

The rest of this guide builds the same idea manually from an empty directory so you can see every
moving part.

## 1. Create the TypeScript package

```bash
mkdir typeweaver-example
cd typeweaver-example
pnpm init
pnpm add -D @rexeus/typeweaver typescript
pnpm add @rexeus/typeweaver-core zod
```

`@rexeus/typeweaver` is the product entry point. It includes the first-party generator plugins; you
select them by name in configuration. `@rexeus/typeweaver-core` and `zod` belong in ordinary
dependencies because your source contract and generated runtime surfaces import them.

Update `package.json` so it contains at least the ESM mode, private-package guard, and TypeWeaver
scripts shown below. Keep the `name`, `version`, and dependency fields created by `pnpm init` and
the install commands.

```json
{
  "private": true,
  "type": "module",
  "scripts": {
    "api:validate": "typeweaver validate --config ./typeweaver.config.mjs",
    "api:generate": "typeweaver generate --config ./typeweaver.config.mjs",
    "api:doctor": "typeweaver doctor --config ./typeweaver.config.mjs --deep",
    "typecheck": "tsc --noEmit"
  }
}
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "esModuleInterop": true,
    "isolatedModules": true,
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "noEmit": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": false,
    "strict": true,
    "target": "ES2024",
    "verbatimModuleSyntax": true
  },
  "include": ["api/**/*.ts", "*.ts"]
}
```

## 2. Author one operation

Create the spec directory and then `api/spec/index.ts`:

```bash
mkdir -p api/spec
```

The project now has the complete package and compiler foundation needed by the remaining steps.

```ts
import {
  defineOperation,
  defineResponse,
  defineSpec,
  HttpMethod,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { z } from "zod";

const TodoSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1),
  completed: z.boolean(),
});

const GetTodoSuccess = defineResponse({
  name: "GetTodoSuccess",
  statusCode: HttpStatusCode.OK,
  description: "The todo was found",
  body: TodoSchema,
});

const TodoNotFound = defineResponse({
  name: "TodoNotFound",
  statusCode: HttpStatusCode.NOT_FOUND,
  description: "The todo does not exist",
  body: z.object({
    message: z.literal("Todo not found"),
    todoId: z.uuid(),
  }),
});

const GetTodo = defineOperation({
  operationId: "getTodo",
  method: HttpMethod.GET,
  path: "/todos/:todoId",
  summary: "Get one todo",
  request: {
    param: z.object({
      todoId: z.uuid(),
    }),
  },
  responses: [GetTodoSuccess, TodoNotFound],
});

export const spec = defineSpec({
  metadata: {
    title: "Todo API",
    version: "1.0.0",
    description: "A small API used to learn TypeWeaver.",
    tags: [
      {
        name: "todos",
        description: "Todo management",
      },
    ],
  },
  resources: {
    todo: {
      description: "Read and manage todos.",
      tags: ["todos"],
      operations: [GetTodo],
    },
  },
});
```

<!-- docs-example: getting-started -->

The contract and configuration used in this walkthrough are checked in the
[getting-started contract](../packages/cli/examples/documentation/getting-started.ts) and
[configuration fixture](../packages/cli/examples/documentation/getting-started.config.mjs).

Three details matter:

1. `operationId` is globally unique and becomes the base name for generated artifacts. Prefer
   camelCase.
2. Paths use `:param` placeholders. Every placeholder must have a matching key in `request.param`.
3. Response names are globally unique. They become discriminators, type names, and response factory
   names.

The first response is the primary success case. Put the normal success result first, then declared
error responses.

## 3. Choose your projections

Create `typeweaver.config.mjs`:

```js
export default {
  input: "./api/spec/index.ts",
  output: "./api/generated",
  plugins: ["clients", "openapi"],
  format: true,
  clean: true,
};
```

The `types` projection is always enabled. In this first pass, TypeWeaver will therefore generate:

- request and response types;
- request and response validators;
- a Fetch client and request command;
- `openapi/openapi.json`.

Plugin options use a tuple:

```js
export default {
  input: "./api/spec/index.ts",
  output: "./api/generated",
  plugins: [
    "clients",
    [
      "openapi",
      {
        target: "3.1.2",
        servers: [
          {
            url: "https://api.example.com",
          },
        ],
        outputPath: "openapi/openapi.json",
      },
    ],
  ],
};
```

## 4. Validate before writing

```bash
pnpm api:validate
```

Validation bundles the configured spec, normalizes it, and asks every configured plugin to report
issues without publishing generated output.

For CI, tighten the threshold:

```bash
pnpm typeweaver validate \
  --config ./typeweaver.config.mjs \
  --strict
```

`--strict` fails on warnings. Use `--json` when automation should consume the versioned validation
report instead of human output.

## 5. Generate the selected surfaces

```bash
pnpm api:generate
```

The relevant output looks like this:

```text
api/generated/
├── index.ts
├── lib/
│   ├── clients/
│   └── types/
├── openapi/
│   └── openapi.json
└── todo/
    ├── GetTodoRequest.ts
    ├── GetTodoRequestValidator.ts
    ├── GetTodoResponse.ts
    ├── GetTodoResponseValidator.ts
    ├── GetTodoRequestCommand.ts
    └── TodoClient.ts
```

Generated output is disposable. Change the source contract or generator configuration, then
regenerate. Do not patch generated files by hand.

## 6. Call the API through the generated client

```ts
import { GetTodoRequestCommand, TodoClient } from "./api/generated/index.js";

const client = new TodoClient({
  baseUrl: "https://api.example.com",
  timeoutMs: 10_000,
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
    console.error(response.body.message, response.body.todoId);
    break;
}
```

<!-- docs-example: generated-client -->

The generated client boundary is typechecked against the regenerated integration project in the
[client fixture](../packages/cli/examples/documentation/generated-client.ts).

The response discriminator narrows the complete response union. Request construction and successful
response parsing pass through the generated validators.

The client accepts a custom `fetchFn`, default headers and query values, an external `AbortSignal`,
and a timeout. Command-specific values override defaults.

## 7. Add a typed server boundary

Extend the config:

```js
export default {
  input: "./api/spec/index.ts",
  output: "./api/generated",
  plugins: ["clients", "server", "openapi"],
};
```

Regenerate:

```bash
pnpm api:validate
pnpm api:generate
```

Implement the generated handler contract:

```ts
import {
  createGetTodoSuccessResponse,
  createTodoNotFoundResponse,
  type ServerTodoApiHandler,
} from "./api/generated/index.js";

export const todoHandlers: ServerTodoApiHandler = {
  async handleGetTodoRequest(request) {
    const todo = await findTodo(request.param.todoId);

    if (!todo) {
      return createTodoNotFoundResponse({
        body: {
          message: "Todo not found",
          todoId: request.param.todoId,
        },
      });
    }

    return createGetTodoSuccessResponse({
      body: todo,
    });
  },
};
```

<!-- docs-example: fetch-server-handler -->

The Fetch-native handler signature and response factory are typechecked in the
[server fixture](../packages/cli/examples/documentation/fetch-server-handler.ts).

Mount it:

```ts
import { TodoRouter, TypeweaverApp } from "./api/generated/index.js";
import { todoHandlers } from "./todo-handlers.js";

export const app = new TypeweaverApp().route(
  new TodoRouter({
    requestHandlers: todoHandlers,
  })
);
```

`app.fetch` is a standard Fetch handler. Connect it to the host adapter for your runtime. Request
and response validation are enabled by default, but the router exposes explicit switches and
error-mapping hooks; see the [Fetch-native server guide](../packages/server/README.md).

Prefer Hono? Replace `server` with `hono`, install Hono, and implement the generated Hono handler
contract instead.

## 8. Evolve the contract

Add `priority` to the Todo schema:

```ts
const TodoSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1),
  completed: z.boolean(),
  priority: z.enum(["low", "normal", "high"]),
});
```

Then run:

```bash
pnpm api:validate
pnpm api:generate
pnpm typecheck
```

This is the core TypeWeaver experience: the source contract changes once, generated surfaces update
together, and TypeScript points to application code that must adapt.

## Add metadata and security without coupling enforcement

Security declarations describe the contract for projections such as clients, command-line flags, and
OpenAPI. They do not implement authentication for your application.

Requirements follow HTTP/OpenAPI semantics:

- schemes inside one requirement object are combined with AND;
- entries in the requirements array are alternatives combined with OR;
- omitting `security` inherits the parent declaration;
- `security: []` makes a resource or operation explicitly public;
- a non-empty declaration replaces the inherited requirement.

Enforcement remains application-owned through middleware, Hono, infrastructure, or another
integration.

## Configuration rules worth knowing

- Config files are JavaScript: `.js`, `.mjs`, or `.cjs`. TypeScript config files are not loaded by
  the published CLI.
- The spec module may export a default value, a named `spec`, or the spec value as its module
  namespace.
- `format` and `clean` default to `true`.
- CLI flags override config values. A `--plugins` list replaces the configured plugin selection for
  that invocation.
- Custom top-level config keys are preserved and exposed to plugins through their context.
- Resource names should preferably be singular camelCase. Operation IDs should preferably be
  camelCase. snake_case and kebab-case are rejected by normalization.

## Diagnose common failures

Run the deep doctor first:

```bash
pnpm api:doctor
```

It checks the runtime, config and spec resolution, plugin availability, output safety, permissions,
Effect compatibility, and formatting setup. Deep mode also bundles, normalizes, and validates the
contract without publishing output.

Typical causes:

| Symptom                                   | Check                                                                                     |
| ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| The spec cannot be loaded                 | Confirm the configured entrypoint and local ESM import extensions                         |
| A path parameter is missing               | Match every `:placeholder` with a key in `request.param`                                  |
| Generation rejects a name                 | Use camelCase operation IDs and resource keys                                             |
| OpenAPI emits a warning                   | Read the stable issue code; the contract uses a shape the target cannot represent exactly |
| A command flag cannot be generated        | Path, query, and header inputs must be finite named object fields                         |
| Generated imports fail after moving files | Keep the generated directory intact and import from its generated barrel                  |

## Next steps

- [CLI reference](../packages/cli/README.md)
- [Contract authoring](../packages/core/README.md)
- [Fetch clients](../packages/clients/README.md)
- [Fetch-native server](../packages/server/README.md)
- [Hono integration](../packages/hono/README.md)
- [OpenAPI projection](../packages/openapi/README.md)
- [Plugin authoring](./plugin-authoring.md)
