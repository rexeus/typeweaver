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

More plugins are planned. If you want to build your own, check out the plugin system

[Plugin system](https://github.com/rexeus/typeweaver/tree/main/packages/gen/README.md#-how-to-use).

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

### ⚙️ Options

- `--input, -i <path>`: Spec entrypoint file (required)
- `--output, -o <path>`: Output directory for generated code (required)
- `--config, -c <path>`: Configuration file path (`.js`, `.mjs`, or `.cjs`, optional)
- `--plugins, -p <plugins>`: Comma-separated list of plugins to use (e.g., "clients,hono" or "all"
  for all plugins)
- `--format / --no-format`: Enable/disable code formatting with oxfmt (default: true)
- `--clean / --no-clean`: Enable/disable output directory cleaning (default: true)

### 📝 Configuration File

Create a JavaScript config file (for example `typeweaver.config.mjs`) for more complex
configurations:

```js
export default {
  input: "./api/spec/index.ts",
  output: "./api/generated",
  plugins: ["clients", "hono", "aws-cdk"],
  format: true,
  clean: true,
};
```

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
