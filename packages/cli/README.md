# 🧵✨ @rexeus/typeweaver

[![npm version](https://img.shields.io/npm/v/@rexeus/typeweaver.svg)](https://www.npmjs.com/package/@rexeus/typeweaver)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-supported-339933?logo=node.js&logoColor=fff)](https://nodejs.org/)
[![Deno](https://img.shields.io/badge/Deno-supported-000?logo=deno&logoColor=fff)](https://deno.land/)
[![Bun](https://img.shields.io/badge/Bun-supported-f9f1e1?logo=bun&logoColor=000)](https://bun.sh/)

Typeweaver is a type-safe HTTP API framework built for API-first development with a focus on
developer experience. Use typeweaver to specify your HTTP APIs in TypeScript and Zod, and generate
clients, validators, routers, and more ✨

---

## 📥 Installation

```bash
# Node.js (npm)
npm install -D @rexeus/typeweaver
npm install @rexeus/typeweaver-core

# Node.js (pnpm)
pnpm add -D @rexeus/typeweaver
pnpm add @rexeus/typeweaver-core

# Deno
deno add npm:@rexeus/typeweaver npm:@rexeus/typeweaver-core

# Bun
bun add -D @rexeus/typeweaver
bun add @rexeus/typeweaver-core
```

Now you are ready to start building! Check out [Quickstart](#-get-started)

## 🎯 Why typeweaver?

- 📝 **Define once, generate everything**: API contracts in Zod become clients, servers, validators,
  and docs.
- 📂 **Resource-based architecture**: APIs organized by resources (like user, todo, project, tag,
  blog-post, etc.), each with its operations and generated components (e.g. clients). Scale
  naturally as your API grows.
- 🔒 **Real type safety**: From API definition to client usage, every request and response is fully
  typed. No more `any` types sneaking in.
- ✅ **Automatic validation**: Invalid requests never reach your code.
- 🔌 **Bring your own framework**: Ready-made adapters for popular frameworks, extensible plugin
  system for everything else.
- 😊 **Finally, DX that doesn't suck**: One schema, no duplication, pure TypeScript.

---

## 🔌 Available Plugins

| Package                                                                                                 | Description                                                                                                 | Version                                                         |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| [@rexeus/typeweaver-types](https://github.com/rexeus/typeweaver/tree/main/packages/types/README.md)     | Plugin for request/response types and validation - the foundation for all other plugins and always included | ![npm](https://img.shields.io/npm/v/@rexeus/typeweaver-types)   |
| [@rexeus/typeweaver-clients](https://github.com/rexeus/typeweaver/tree/main/packages/clients/README.md) | Plugin for HTTP clients using fetch                                                                         | ![npm](https://img.shields.io/npm/v/@rexeus/typeweaver-clients) |
| [@rexeus/typeweaver-server](https://github.com/rexeus/typeweaver/tree/main/packages/server/README.md)   | Plugin for a zero-dependency, Fetch API-native server with built-in routing and middleware                  | ![npm](https://img.shields.io/npm/v/@rexeus/typeweaver-server)  |
| [@rexeus/typeweaver-hono](https://github.com/rexeus/typeweaver/tree/main/packages/hono/README.md)       | Plugin for Hono routers                                                                                     | ![npm](https://img.shields.io/npm/v/@rexeus/typeweaver-hono)    |
| [@rexeus/typeweaver-aws-cdk](https://github.com/rexeus/typeweaver/tree/main/packages/aws-cdk/README.md) | Plugin for AWS CDK constructs for API Gateway V2                                                            | ![npm](https://img.shields.io/npm/v/@rexeus/typeweaver-aws-cdk) |
| [@rexeus/typeweaver-openapi](https://github.com/rexeus/typeweaver/tree/main/packages/openapi/README.md) | Plugin for OpenAPI 3.1.2 (default) and explicit 3.2.0 JSON documents                                        | ![npm](https://img.shields.io/npm/v/@rexeus/typeweaver-openapi) |

More plugins are planned. If you want to build your own, start with the
[Plugin authoring guide](https://github.com/rexeus/typeweaver/tree/main/docs/plugin-authoring.md).

---

## ⌨️ CLI

Generate TypeScript code from a spec entrypoint file:

```bash
# Node.js (npm)
npx typeweaver generate --input ./api/spec/index.ts --output ./api/generated --plugins clients

# Node.js (pnpm)
pnpx typeweaver generate --input ./api/spec/index.ts --output ./api/generated --plugins clients

# Deno
deno run -A npm:@rexeus/typeweaver generate --input ./api/spec/index.ts --output ./api/generated --plugins clients

# Bun
bunx typeweaver generate --input ./api/spec/index.ts --output ./api/generated --plugins clients
```

> **Note**: Deno may require the `--sloppy-imports` flag or equivalent configuration in `deno.json`
> when your API definitions use extensionless TypeScript imports.

### Scaffold a plugin

Create a complete third-party plugin starter without prompts:

```bash
npx typeweaver add plugin --name audit-log --target ./typeweaver-plugin-audit-log
cd typeweaver-plugin-audit-log
pnpm install
pnpm check
```

The target directory must not exist; the command never overwrites user files. Plugin names use
lowercase kebab-case. The starter contains a package manifest, strict TypeScript configuration,
minimal and configurable plugin exports, a generation fixture, and tests built only on the public
`createPluginTestKit` and `defineScopedPlugin` APIs.

`pnpm check` typechecks, tests, builds, and runs the plugin against the included spec. The scaffold
develops against Effect 3.22.0 and declares the supported plugin peer range `>=3.22.0 <4`.

### Initialize a project

Create an executable Todo API starter in an explicit directory:

```bash
npx typeweaver init --target ./todo-api
cd todo-api
pnpm install
pnpm validate
pnpm generate
```

The starter contains five Todo operations, reusable and derived error responses, a strict TypeScript
configuration, package scripts, and a client-generation config. A missing package manifest is
created; an existing `package.json` is preserved.

`init` refuses any non-empty target unless `--force` is present. Force mode overwrites only
conflicting starter files and rolls every published file back if a later publication fails. Inspect
the deterministic plan without creating the target with `--dry-run`. Use
`--config-format mjs|cjs|js` to select the config module format.

Human output goes to stdout on success and stderr on failure. `--json` always writes one versioned
`InitReport` to stdout; automation can validate it with the public `InitReportSchema`. Stable
failure codes are `TW-INIT-001` through `TW-INIT-005`, and failures exit 1.

### Validate without writing

Validate the normalized spec and every configured plugin without touching the configured output:

```bash
npx typeweaver validate --input ./api/spec/index.ts
npx typeweaver validate --config ./typeweaver.config.mjs --json
```

Validation uses a scoped temporary bundle that is removed before the command exits. Human failures
are written to stderr. `--json` writes one versioned `ValidationReport` document to stdout; the
public `ValidationReportSchema` export can validate it in automation.

The default exit threshold is `error`. Use `--fail-on warning`, `--fail-on info`, or `--strict`
(`warning`) to tighten CI. Exit code 0 means no issue met the threshold; exit code 1 means at least
one did. Normalization failures retain their stable `TW-SPEC-*` codes, normalized contract warnings
use `TW-SPEC-101` through `TW-SPEC-103`, and plugin validation issues retain the plugin's declared
code.

### Diagnose a project

Run deterministic environment and project checks without generating output:

```bash
npx typeweaver doctor \
  --input ./api/spec/index.ts \
  --output ./api/generated

npx typeweaver doctor --config ./typeweaver.config.mjs --deep --json
```

The standard checks cover runtime detection, Node.js 24, the pnpm 10.34.5 repository workflow,
configuration and spec resolution, plugin availability, output safety and permissions, the supported
Effect range, and optional oxfmt availability. `--deep` additionally bundles, normalizes, and
validates the spec through a scoped temporary directory that is removed before exit.

Human output gives every check a stable `TW-DOCTOR-001` through `TW-DOCTOR-010` code and a `pass`,
`warn`, `fail`, or `skip` outcome. `--json` emits exactly one versioned `DoctorReport` on stdout;
automation can validate it with the public `DoctorReportSchema`. Exit code 0 means no check failed
(warnings are advisory); exit code 1 means at least one check failed. Neither mode writes project
output.

### ⚙️ Generate options

- `--input, -i <path>`: Spec entrypoint file (required via flag or config)
- `--output, -o <path>`: Output directory for generated code (required via flag or config)
- `--config, -c <path>`: Configuration file path (`.js`, `.mjs`, or `.cjs`, optional)
- `--plugins, -p <plugins>`: Comma-separated list of plugins to use (e.g., "clients,hono" or "all"
  for all plugins)
- `--format / --no-format`: Enable/disable code formatting with oxfmt (default: true)
- `--clean / --no-clean`: Enable/disable output directory cleaning (default: true)
- `--verbose`: Enable debug-level logging (effect spans, plugin loader attempts, lock
  acquire/release). Useful when triaging unexpected behavior.
- `--version, -V`: Print the CLI version.

### 📝 Configuration File

Create a JavaScript config file (for example `typeweaver.config.mjs`) for more complex
configurations:

```js
/** @type {import("@rexeus/typeweaver-gen").TypeweaverConfig} */
export default {
  input: "./api/spec/index.ts",
  output: "./api/generated",
  plugins: ["clients", "hono", "aws-cdk", "openapi"],
  format: true,
  clean: true,
};
```

<!-- docs-example: generation-cli-config -->

The configuration shape and plugin options are checked in the executable
[CLI configuration fixture](./examples/documentation/typeweaver.config.mjs).

The loader accepts either a default export or a named `config` export — pick whichever fits your
project's style. Custom top-level keys are preserved and exposed to plugins through
`context.config`.

Then run:

```bash
npx typeweaver generate --config ./typeweaver.config.mjs
```

> Replace `npx` with `pnpx`, `deno run -A npm:@rexeus/typeweaver`, or `bunx` depending on your
> runtime.
>
> TypeScript config files (`.ts`, `.mts`, `.cts`) are no longer supported by the published CLI.
> Convert them to JavaScript first if needed.

## 🌱 Get Started

### 📁 Project Structure

Typeweaver reads a single spec entrypoint. Organize files however you want, then assemble the
resource map in `defineSpec(...)`. Here is an example layout:

```text
api/spec/
├── index.ts                              # Spec entrypoint — exports defineSpec(...)
├── user/
│   ├── index.ts                          # Barrel exports for the user resource
│   ├── userSchema.ts                     # Zod schemas for the user entity
│   ├── GetUserDefinition.ts              # defineOperation(...) for GET /users/:userId
│   └── errors/
│       └── UserNotFoundErrorDefinition.ts
└── shared/
    ├── sharedResponses.ts                # Array of common error responses
    └── ValidationErrorDefinition.ts
```

This is just one way to organize your spec. The directory layout is up to you — typeweaver only
cares about the `defineSpec(...)` entrypoint, not about folder names or file conventions.

- Resource names come from `defineSpec({ resources: ... })`, not from directory names.
- Shared responses and schemas can live anywhere that your spec entrypoint imports from.
- The CLI bundles the entrypoint, so local spec imports should stay within your project.

### 💻 Sample Spec

```typescript
// api/spec/user/GetUserDefinition.ts
import {
  defineOperation,
  defineResponse,
  HttpMethod,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { z } from "zod";
import { sharedResponses } from "../shared/sharedResponses";
import { userSchema } from "./userSchema";
import { UserNotFoundErrorDefinition } from "./errors/UserNotFoundErrorDefinition";

export const GetUserDefinition = defineOperation({
  operationId: "getUser",
  method: HttpMethod.GET,
  path: "/users/:userId",
  summary: "Get a user by id",
  request: {
    param: z.object({
      userId: z.uuid(),
    }),
  },
  responses: [
    defineResponse({
      name: "GetUserSuccess",
      statusCode: HttpStatusCode.OK,
      description: "User successfully retrieved",
      header: z.object({
        "Content-Type": z.literal("application/json"),
      }),
      body: userSchema,
    }),
    UserNotFoundErrorDefinition,
    ...sharedResponses,
  ],
});
```

```typescript
// api/spec/index.ts
import { defineSpec } from "@rexeus/typeweaver-core";
import { GetUserDefinition } from "./user/GetUserDefinition";

export const spec = defineSpec({
  metadata: { title: "Users API", version: "1.0.0" },
  resources: {
    user: {
      operations: [GetUserDefinition],
    },
  },
});
```

```typescript
// api/spec/user/userSchema.ts
import { z } from "zod";

export const userStatusSchema = z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]);

export const userSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
  status: userStatusSchema,
  createdAt: z.iso.date(),
  updatedAt: z.iso.date(),
});
```

```typescript
// api/spec/shared/sharedResponses.ts
import { ForbiddenErrorDefinition } from "./ForbiddenErrorDefinition";
import { InternalServerErrorDefinition } from "./InternalServerErrorDefinition";
import { TooManyRequestsErrorDefinition } from "./TooManyRequestsErrorDefinition";
import { UnauthorizedErrorDefinition } from "./UnauthorizedErrorDefinition";
import { UnsupportedMediaTypeErrorDefinition } from "./UnsupportedMediaTypeErrorDefinition";
import { ValidationErrorDefinition } from "./ValidationErrorDefinition";

export const sharedResponses = [
  ForbiddenErrorDefinition,
  InternalServerErrorDefinition,
  TooManyRequestsErrorDefinition,
  UnauthorizedErrorDefinition,
  UnsupportedMediaTypeErrorDefinition,
  ValidationErrorDefinition,
];
```

### 🔧 Generate using plugins

```bash
# Generate with plugins:
# - Hono: to easily provide a web server
# - Clients: to get fitting API clients
npx typeweaver generate --input ./api/spec/index.ts --output ./api/generated --plugins clients,hono
```

> The CLI accepts a default export, a named `spec` export, or the module namespace itself as the
> `SpecDefinition` entrypoint.

### 🌐 Create Hono web server

```typescript
// api/user-handlers.ts
import type { Context } from "hono";
import type { HonoUserApiHandler, IGetUserRequest, GetUserResponse } from "./generated";
import { createGetUserSuccessResponse } from "./generated";

// Implement HonoUserApiHandler — the generated interface enforces
// that every operation in the "user" resource has a handler.
export class UserHandlers implements HonoUserApiHandler {
  public constructor() {}

  public async handleGetUserRequest(
    request: IGetUserRequest,
    context: Context
  ): Promise<GetUserResponse> {
    // Simulate fetching user data
    const fetchedUser = {
      id: request.param.userId,
      name: "John Doe",
      email: "john.doe@example.com",
      status: "ACTIVE",
      createdAt: new Date("2023-01-01").toISOString(),
      updatedAt: new Date("2023-01-01").toISOString(),
    };

    return createGetUserSuccessResponse({
      header: {
        "Content-Type": "application/json",
      },
      body: fetchedUser,
    });
  }

  // Implement further handlers for each operation in the resource.
  // TypeScript enforces the contract — every handler declared in
  // HonoUserApiHandler must be implemented before the code compiles.
}
```

```typescript
// api/server.ts
import { serve } from "@hono/node-server";
import { Hono } from "hono";
// an index file exporting all generated components is automatically provided
import { UserHandlers } from "./user-handlers";
import { PostHandlers } from "./post-handlers"; // Implement similarly to UserHandlers
import { UserHono, PostHono } from "./generated";

const app = new Hono();

const userHandlers = new UserHandlers();
const postHandlers = new PostHandlers();

// you have further config options, e.g. custom error response handling
// (useful for mapping validation errors to your specific response format)
const userRouter = new UserHono({
  requestHandlers: userHandlers,
});
const postRouter = new PostHono({
  requestHandlers: postHandlers,
});

app.route("/", userRouter);
app.route("/", postRouter);

// Start server on port 3000
serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  () => {
    console.log("Server is running on http://localhost:3000");
  }
);
```

```bash
# Start your server locally
tsx api/server.ts
```

### 🔗 Communicate by using Clients

```typescript
// api/client-test.ts
import { UserClient, GetUserRequestCommand } from "./generated";

const client = new UserClient({ baseUrl: "http://localhost:3000" });

const getUserRequestCommand = new GetUserRequestCommand({
  param: { userId: "123" },
});
const response = await client.send(getUserRequestCommand);

if (response.type === "GetUserSuccess") {
  console.log("Successfully fetched user:", response.body);
} else if (response.type === "UserNotFoundError") {
  console.error("User not found:", response.body);
} else {
  console.error("Other error occurred:", response.type);
}
```

```bash
# Call your created Hono server
tsx api/client-test.ts
```

## 📄 License

Apache 2.0 © Dennis Wentzien 2026
