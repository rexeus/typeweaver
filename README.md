# 🧵✨ typeweaver

[![npm version](https://img.shields.io/npm/v/@rexeus/typeweaver.svg)](https://www.npmjs.com/package/@rexeus/typeweaver)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

Typeweaver is a type-safe API framework built for API-first development with a focus on developer
experience. Use typeweaver to specify your APIs in TypeScript and Zod, and generate clients,
validators, routers, and more ✨

---

## 📥 Installation

```bash
# Install the CLI as a dev dependency
npm install -D @rexeus/typeweaver

# Install the runtime as a dependency
npm install @rexeus/typeweaver-core
```

Now you are ready to start building your APIs! Check out [Quickstart](#-quickstart)

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
- 🔒 **Real type safety**: From API definition to client usage, every request and response is fully
  typed. No more `any` types sneaking in.
- ✅ **Automatic validation**: Invalid requests never reach your code.
- 🔌 **Bring your own framework**: Ready-made adapters for popular frameworks, extensible plugin
  system for everything else.
- 😊 **Finally, DX that doesn't suck**: One schema, no duplication, pure TypeScript.

## 📦 Packages

Typeweaver is modular by design. Install only what you need.

### Foundational packages

| Package                                      | Description                                      | Version                                                       |
| -------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------- |
| [@rexeus/typeweaver](./packages/cli)         | CLI tool for code generation                     | ![npm](https://img.shields.io/npm/v/@rexeus/typeweaver)       |
| [@rexeus/typeweaver-core](./packages/core)   | Core types for API specification                 | ![npm](https://img.shields.io/npm/v/@rexeus/typeweaver-core)  |
| [@rexeus/typeweaver-gen](./packages/gen)     | Code generation engine and plugin system         | ![npm](https://img.shields.io/npm/v/@rexeus/typeweaver-gen)   |
| [@rexeus/typeweaver-types](./packages/types) | Plugin for request/response types and validation | ![npm](https://img.shields.io/npm/v/@rexeus/typeweaver-types) |

### Plugins

| Package                                          | Description                           | Version                                                         |
| ------------------------------------------------ | ------------------------------------- | --------------------------------------------------------------- |
| [@rexeus/typeweaver-clients](./packages/clients) | HTTP client generators using Axios    | ![npm](https://img.shields.io/npm/v/@rexeus/typeweaver-clients) |
| [@rexeus/typeweaver-hono](./packages/hono)       | Plugin for Hono routers               | ![npm](https://img.shields.io/npm/v/@rexeus/typeweaver-hono)    |
| [@rexeus/typeweaver-aws-cdk](./packages/aws-cdk) | AWS CDK constructs for API Gateway V2 | ![npm](https://img.shields.io/npm/v/@rexeus/typeweaver-aws-cdk) |

More plugins are planned. Want to build your own? Check out the plugin system
[Plugin system](./packages/gen).

---

## 🚀 Quickstart

### Basic Usage

1. **Define your API contract:**

```typescript
// api/definition/user/GetUserDefinition.ts
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
    UserNotFoundErrorDefinition, // Error response
    ...sharedResponses, // Reuse common errors across operations
  ],
});
```

**2. Define custom error responses:**

```typescript
// api/definition/user/errors/UserNotFoundErrorDefinition.ts
import { HttpResponseDefinition, HttpStatusCode } from "@rexeus/typeweaver-core";
import { z } from "zod/v4";
import NotFoundErrorDefinition from "./NotFoundErrorDefinition";

export default NotFoundErrorDefinition.extend({
  name: "UserNotFoundError",
  description: "User not found",
  body: z.object({
    message: z.literal("User not found"),
    code: z.literal("USER_NOT_FOUND_ERROR"),
    actualValues: z.object({
      userId: z.uuid(),
    }),
  }),
});
```

3. **Generate the code:**

```bash
npx typeweaver generate --input ./api/definition --output ./api/generated --plugins clients,hono
```

4. **Use the generated type-safe client:**

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
  // Fully typed request and response
  const result = await client.send(getUserRequestCommand);
  console.log(result.body.name);
} catch (error) {
  // Errors are also fully typed
  if (error instanceof UserNotFoundErrorResponse) {
    console.error(`User ${error.body.actualValues.userId} not found`);
  }
}
```

5. **Validate requests:**

```typescript
import { GetUserRequestValidator } from "./api/generated";

const validator = new GetUserRequestValidator();
const validationResult = validator.safeValidate({
  method: "GET",
  path: "/users/d3882a0e-8241-4a71-ad38-5778835ef596",
  param: { userId: "d3882a0e-8241-4a71-ad38-5778835ef596" },
  header: { Authorization: "Bearer token", Accept: "application/json" },
});

if (validationResult.isValid) {
  // Valid request, of course typed!
  console.log(validationResult.data.param.userId);
} else {
  // Handle validation errors with detailed information about each issue
  console.error("Header issues", validationResult.error.headerIssues);
  console.error("Param issues", validationResult.error.paramIssues);
  // etc.
}
```

6. **Serve your API:**

```typescript
TODO;
```

## License

Apache 2.0 © Dennis Wentzien 2025
