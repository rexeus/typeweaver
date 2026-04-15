# 🧵✨ typeweaver

[![npm version](https://img.shields.io/npm/v/@rexeus/typeweaver.svg)](https://www.npmjs.com/package/@rexeus/typeweaver)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-supported-339933?logo=node.js&logoColor=fff)](https://nodejs.org/)
[![Deno](https://img.shields.io/badge/Deno-supported-000?logo=deno&logoColor=fff)](https://deno.land/)
[![Bun](https://img.shields.io/badge/Bun-supported-f9f1e1?logo=bun&logoColor=000)](https://bun.sh/)

Typeweaver is a type-safe HTTP API framework built for API-first development with a focus on
developer experience. Use typeweaver to specify your HTTP APIs in TypeScript and Zod, and generate
clients, validators, routers, and more ✨

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

OpenAPI is the industry standard for defining APIs, but I was never satisfied with the developer
experience it provided. Writing YAMLs and JSON Schemas for huge projects felt cumbersome, and
generators for TypeScript clients and servers often fell short.

Meanwhile, [Zod](https://github.com/colinhacks/zod) is sitting right there 👀. Writing schemas with
it feels like a breeze—beautiful syntax, powerful utilities like pick, omit, merge etc, all built
for TypeScript from ground up.

So why not use Zod to define your API contracts?

That's exactly what typeweaver does. Define your APIs with Zod schemas and focus on what
matters—designing great APIs and implementing business logic. The boilerplate? That's generated ✅.
The type safety? It's real 🔒. The developer experience? Finally, it's what it should be 🚀.

## 🌱 Project Status

Early-stage and actively working toward a stable 1.0. We’re expanding test coverage, running
performance tests, and refining definition ingestion and the normalized output format used for
generation — while keeping the project fully usable today.

## 🎯 Why typeweaver?

- 📝 **Define once, generate everything**: API contracts in Zod become clients, routers, validators,
  and more.
- 📂 **Resource-based architecture**: APIs organized by resources (like users, todos, projects, tags
  etc.), each with its operations and generated components (e.g. clients). Scale naturally as your
  API grows.
- 🔒 **Real type safety**: From API definition to client usage, every request and response is fully
  typed. No more `any` types sneaking in.
- ✅ **Automatic validation**: Invalid requests never reach your code.
- 🔌 **Bring your own framework**: Ready-made adapters for popular frameworks, extensible plugin
  system for everything else.
- 😊 **Delightful DX**: One schema, no duplication, pure TypeScript 🚀.

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

| Package                                                    | Description                                                                 | Version                                                         |
| ---------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------- |
| [@rexeus/typeweaver-clients](./packages/clients/README.md) | HTTP client generators using the Fetch API                                  | ![npm](https://img.shields.io/npm/v/@rexeus/typeweaver-clients) |
| [@rexeus/typeweaver-hono](./packages/hono/README.md)       | Generates type-safe Hono routers with validation and error handling         | ![npm](https://img.shields.io/npm/v/@rexeus/typeweaver-hono)    |
| [@rexeus/typeweaver-server](./packages/server/README.md)   | Generates a lightweight, dependency-free server with routing and middleware | ![npm](https://img.shields.io/npm/v/@rexeus/typeweaver-server)  |
| [@rexeus/typeweaver-aws-cdk](./packages/aws-cdk/README.md) | AWS CDK constructs for API Gateway V2                                       | ![npm](https://img.shields.io/npm/v/@rexeus/typeweaver-aws-cdk) |

> **Server vs Hono?** The [Server plugin](./packages/server/README.md) is a dependency-free, Fetch
> API-native server — ideal for Bun, Deno, and Cloudflare Workers. The
> [Hono plugin](./packages/hono/README.md) generates routers for the Hono framework — ideal if you
> already use Hono or want its middleware ecosystem.

### Internal packages

| Package                                       | Description                                       |
| --------------------------------------------- | ------------------------------------------------- |
| [test-utils](./packages/test-utils/README.md) | Shared test utilities, fixtures, and test servers |

More plugins are planned. Want to build your own? Check out the plugin system

[Plugin system](./packages/gen/README.md#-how-to-use).

---

## 🚀 Quickstart

1. **Author a spec entrypoint:**

```typescript
// api/spec/user/GetUserDefinition.ts
import {
  defineOperation,
  defineResponse,
  HttpMethod,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { z } from "zod";
import { UserNotFoundErrorDefinition } from "./errors/UserNotFoundErrorDefinition";
import { sharedResponses } from "../shared/sharedResponses";

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
      body: z.object({
        id: z.uuid(),
        name: z.string(),
        email: z.email(),
      }),
    }),
    UserNotFoundErrorDefinition, // Define error responses
    ...sharedResponses, // Reuse common errors across operations
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

2. **Example project structure:**

The directory layout is up to you. Typeweaver only cares about the `defineSpec(...)` entrypoint, not
about folder names. Here is one common way to organize a project:

```
api/
├── spec/
│   ├── index.ts         # Spec entrypoint — exports defineSpec(...)
│   ├── user/
│   │   ├── errors/
│   │   │   └── UserNotFoundErrorDefinition.ts
│   │   └── GetUserDefinition.ts
│   └── shared/
│       └── sharedResponses.ts
└── generated/           # Generated by typeweaver
    ├── user/
    │   ├── UserClient.ts
    │   └── ...
    └── index.ts          # Entry point exports
```

Resource names come from `defineSpec({ resources: ... })`, not from folder names.

3. **Generate code**

```bash
# Select the plugins you want to use
# -> In this case "clients" for type-safe Http-Clients, "hono" for Hono framework integration
npx typeweaver generate --input ./api/spec/index.ts --output ./api/generated --plugins clients,hono

# Or use the built-in server (zero external dependencies)
npx typeweaver generate --input ./api/spec/index.ts --output ./api/generated --plugins clients,server
```

4. **Use the generated code**

```typescript
import { UserClient, GetUserRequestCommand } from "./api/generated";

const client = new UserClient({
  baseUrl: "https://api.example.com",
});

const getUserRequestCommand = new GetUserRequestCommand({
  param: {
    userId: "d3882a0e-8241-4a71-ad38-5778835ef596",
  },
});

const response = await client.send(getUserRequestCommand);

// TypeScript discriminates between different response types via the `type` field
if (response.type === "GetUserSuccess") {
  console.log(response.body.name);
} else if (response.type === "UserNotFoundError") {
  console.error(`User not found`);
}
```

&rarr; That's it! Start building your API. [Get started](./packages/cli/README.md#-get-started)

---

## 🤝 Contributing

Contributions are very welcome — from docs and examples to bug fixes, new plugins and features.

## 💬 Feedback & Issues

We’d love to hear your feedback — on API design, DX, docs, issues and ideas. Report them
[here](https://github.com/rexeus/typeweaver/issues).

---

## License

Apache 2.0 © Dennis Wentzien 2026
