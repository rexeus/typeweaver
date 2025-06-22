# TypeWeaver

Type-safe API framework with code generation for TypeScript

## Overview

TypeWeaver provides a complete solution for building type-safe APIs in TypeScript. Define your API
contract once using Zod schemas, then automatically generate type-safe clients, validators, and
server routers and other components like routes for AWS ApiGateway.

This generations will be pluggable in the future.

### Why TypeWeaver?

- **Single Source of Truth**: Define your API contract once, generate everything else
- **End-to-End Type Safety**: From API definition to client usage, everything is fully typed
- **Runtime Validation**: Automatic request/response validation using Zod schemas
- **Framework Agnostic**: Adapters for AWS ApiGateway, AWS Lambda, Hono, and more (will be pluggable
  in the future)

## Packages

This monorepo contains two packages:

| Package                                    | Description                                                      | Version                                                      |
| ------------------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------ |
| [@rexeus/typeweaver](./packages/cli)       | CLI tool for generating type-safe API code                       | ![npm](https://img.shields.io/npm/v/@rexeus/typeweaver)      |
| [@rexeus/typeweaver-core](./packages/core) | Core types for specifications and core components for generation | ![npm](https://img.shields.io/npm/v/@rexeus/typeweaver-core) |

## Quick Start

### Installation

```bash
# Install the CLI as a dev dependency
npm install -D @rexeus/typeweaver

# Install the runtime as a dependency
npm install @rexeus/typeweaver-core
```

### Basic Usage

1. **Define your API contract:**

```typescript
// api/definitions/users/GetUserDefinition.ts
import { HttpOperationDefinition, HttpMethod, HttpStatusCode } from "@rexeus/typeweaver-core";
import { z } from "zod/v4";
import UserNotFoundErrorDefinition from "../shared/UserNotFoundErrorDefinition";
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
      status: HttpStatusCode.OK,
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
    UserNotFoundErrorDefinition,
    ...sharedResponses, // Could be used for common errors: 401, 403, 429, 500, etc.
  ],
});
```

**Define custom error responses (in shared directory):**

```typescript
// api/definitions/shared/UserNotFoundErrorDefinition.ts
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

2. **Generate the code:**

```bash
npx typeweaver generate --input ./api/definition --output ./api/generated
```

3. **Use the generated type-safe client:**

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
  // Fully typed request and response!
  const result = await client.send(getUserRequestCommand);
  console.log(result.body.name); // Type-safe access to user name
} catch (error) {
  // Errors are also fully typed!
  if (error instanceof UserNotFoundErrorResponse) {
    console.error(`User ${error.body.actualValues.userId} not found`);
  }

  // ...
}
```

4. **Validate requests:**

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
  // Request is valid with typed data
  console.log(validationResult.data.param.userId);
} else {
  // Handle validation errors
  console.error(validationResult.error.issues);
}
```

## Acknowledgments

Built with:

- [TypeScript](https://github.com/microsoft/TypeScript) - For type safety
- [Zod](https://github.com/colinhacks/zod) - For runtime validation
- [Hono](https://github.com/honojs/hono) - For lightweight web framework
