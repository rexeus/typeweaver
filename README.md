# 🧵✨ typeweaver

[![npm version](https://img.shields.io/npm/v/@rexeus/typeweaver.svg)](https://www.npmjs.com/package/@rexeus/typeweaver)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

Typeweaver is a type-safe HTTP API framework built for API-first development with a focus on
developer experience. Use typeweaver to specify your HTTP APIs in TypeScript and Zod, and generate
clients, validators, routers, and more ✨

---

## 📥 Installation

```bash
# Install the CLI as a dev dependency
npm install -D @rexeus/typeweaver

# Install the runtime as a dependency
npm install @rexeus/typeweaver-core
```

Now you are ready to start building! Check out [Quickstart](#-Quickstart)

---

## 💡 Motivation

OpenAPI is the standard for defining APIs, but I was never satisfied with the developer experience
it provided. Writing YAMLs and JSON Schemas for huge projects felt cumbersome, and generators for
TypeScript clients and servers often fell short.

Meanwhile, Zod is sitting right there 👀. Writing schemas with it feels like a breeze—beautiful
syntax, powerful utilities like pick, omit, merge etc, all built for TypeScript from ground up.

So why not use Zod to define your API contracts?

That's exactly what Typeweaver does. Define your APIs with Zod schemas and focus on what
matters—designing great APIs and implementing business logic. The boilerplate? That's generated ✅.
The type safety? It's real 🔒. The developer experience? Finally, it's what it should be 🚀.

## 🎯 Why typeweaver?

- 📝 **Define once, generate everything**: API contracts in Zod become clients, servers, validators,
  and docs.
- 📂 **Resource-based architecture**: APIs organized by resources (like users, todos, projects, tags
  etc.), each with its operations and generated components (e.g. clients). Scale naturally as your
  API grows.
- 🔒 **Real type safety**: From API definition to client usage, every request and response is fully
  typed. No more `any` types sneaking in.
- ✅ **Automatic validation**: Invalid requests never reach your code.
- 🔌 **Bring your own framework**: Ready-made adapters for popular frameworks, extensible plugin
  system for everything else.
- 😊 **Finally, DX that doesn't suck**: One schema, no duplication, pure TypeScript.

---

## 📦 Packages

Typeweaver is modular by design. Install only what you need.

### Foundational packages

| Package                                                | Description                                      | Version                                                       |
| ------------------------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------- |
| [@rexeus/typeweaver](./packages/cli/README.md)         | CLI tool for code generation                     | ![npm](https://img.shields.io/npm/v/@rexeus/typeweaver)       |
| [@rexeus/typeweaver-core](./packages/core/README.md)   | Core types for API specification                 | ![npm](https://img.shields.io/npm/v/@rexeus/typeweaver-core)  |
| [@rexeus/typeweaver-gen](./packages/gen/README.md)     | Code generation engine and plugin system         | ![npm](https://img.shields.io/npm/v/@rexeus/typeweaver-gen)   |
| [@rexeus/typeweaver-types](./packages/types/README.md) | Plugin for request/response types and validation | ![npm](https://img.shields.io/npm/v/@rexeus/typeweaver-types) |

### Plugins

| Package                                                    | Description                           | Version                                                         |
| ---------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------- |
| [@rexeus/typeweaver-clients](./packages/clients/README.md) | HTTP client generators using Axios    | ![npm](https://img.shields.io/npm/v/@rexeus/typeweaver-clients) |
| [@rexeus/typeweaver-hono](./packages/hono/README.md)       | Plugin for Hono routers               | ![npm](https://img.shields.io/npm/v/@rexeus/typeweaver-hono)    |
| [@rexeus/typeweaver-aws-cdk](./packages/aws-cdk/README.md) | AWS CDK constructs for API Gateway V2 | ![npm](https://img.shields.io/npm/v/@rexeus/typeweaver-aws-cdk) |

More plugins are planned. Want to build your own? Check out the plugin system

<!-- TODO: add corect link -->

[Plugin system](./packages/gen/README.md#plugins).

---

## 🚀 Quickstart

1. **Define your API contract:**

```typescript
// api/definition/user/GetUserDefinition.ts
// -> "user" folder = User resource. Each resource defines its own operations, and gets in case of the clients plugin its dedicated client.

import { HttpOperationDefinition, HttpMethod, HttpStatusCode } from "@rexeus/typeweaver-core";
import { z } from "zod/v4";
import UserNotFoundErrorDefinition from "./errors/UserNotFoundErrorDefinition";
import { sharedResponses } from "../shared/sharedResponses";

export default new HttpOperationDefinition({
  operationId: "GetUser",
  method: HttpMethod.GET,
  path: "/users/:userId",
  request: {
    param: z.object({
      userId: z.uuid(),
    }),
  },
  responses: [
    {
      statusCode: HttpStatusCode.OK,
      description: "User successfully retrieved",
      header: z.object({
        "Content-Type": z.literal("application/json"),
      }),
      body: z.object({
        id: z.uuid(),
        name: z.string(),
        email: z.email(),
      }),
    },
    UserNotFoundErrorDefinition, // Define error responses
    ...sharedResponses, // Reuse common errors across operations
  ],
});
```

2. **Project structure:**

```
api/
├── definition/          # Your API contracts
│   ├── users/
│   │   ├── errors/      # Resource-specific error definitions
│   │   │   └── UserNotFoundErrorDefinition.ts
│   │   ├── GetUserDefinition.ts
│   │   ├── CreateUserDefinition.ts
│   │   ├── UpdateUserDefinition.ts
│   │   └── ...
│   ├── todos/
│   │   ├── GetTodosDefinition.ts
│   │   └── ...
│   └── shared/          # Cross-resource responses & schemas
│       └── sharedResponses.ts
└── generated/           # Generated by typeweaver
    ├── users/
    │   ├── UsersClient.ts
    │   └── ...
    ├── todos/
    │   ├── TodosClient.ts
    │   └── ...
    └── index.ts          # Entry point exports
```

3. **Generate code**

```bash
# Select the plugins you want to use
# -> In this case "clients" for type-safe Http-Clients, "hono" for Hono framework integration
npx typeweaver generate --input ./api/definition --output ./api/generated --plugins clients,hono
```

4. **Use the generated code**

```typescript
import {
  UserClient,
  GetUserRequestCommand,
  UserNotFoundErrorResponse,
  ValidationErrorResponse,
} from "./api/generated";

const client = new UserClient({
  baseURL: "https://api.example.com",
});

const getUserRequestCommand = new GetUserRequestCommand({
  param: {
    userId: "d3882a0e-8241-4a71-ad38-5778835ef596",
  },
});

try {
  const result = await client.send(getUserRequestCommand); // TypeScript infers: { statusCode: 200, body: { id: string, name: string, email: string } }
  console.log(result.body.name);
} catch (error) {
  // TypeScript discriminates between different error types automatically
  if (error instanceof UserNotFoundErrorResponse) {
    console.error(`User "${error.body.actualValues.userId}" not found`);
  }
}
```

&rarr; That's it! Start building your API. [Get started](./packages/cli/README.md#-get-started)

---

## License

Apache 2.0 © Dennis Wentzien 2025
