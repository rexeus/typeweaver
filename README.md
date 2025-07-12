# TypeWeaver

Type-safe API framework with code generation for TypeScript

## Overview

TypeWeaver provides a complete solution for building type-safe APIs in TypeScript. Define your API
contract once using Zod schemas, then automatically generate type-safe clients, validators, and
server routers and other components like routes for AWS ApiGateway.

The generation is fully extensible through a plugin system.

### Why TypeWeaver?

- **Single Source of Truth**: Define your API contract once, generate everything else
- **End-to-End Type Safety**: From API definition to client usage, everything is fully typed
- **Runtime Validation**: Automatic request/response validation using Zod schemas
- **Framework Agnostic**: Plugin-based architecture with adapters for AWS Lambda, Hono, Express, and more

## Packages

This monorepo contains six packages:

| Package                                          | Description                                                           | Version                                                            |
| ------------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [@rexeus/typeweaver](./packages/cli)             | CLI tool for generating type-safe API code                           | ![npm](https://img.shields.io/npm/v/@rexeus/typeweaver)            |
| [@rexeus/typeweaver-core](./packages/core)       | Core TypeScript and Zod utilities for TypeWeaver API definitions    | ![npm](https://img.shields.io/npm/v/@rexeus/typeweaver-core)       |
| [@rexeus/typeweaver-gen](./packages/gen)         | Code generation engine and utilities for TypeWeaver plugins          | ![npm](https://img.shields.io/npm/v/@rexeus/typeweaver-gen)        |
| [@rexeus/typeweaver-types](./packages/types)     | TypeScript type and Zod validator generators for TypeWeaver APIs     | ![npm](https://img.shields.io/npm/v/@rexeus/typeweaver-types)      |
| [@rexeus/typeweaver-clients](./packages/clients) | HTTP client generators for TypeWeaver API specifications             | ![npm](https://img.shields.io/npm/v/@rexeus/typeweaver-clients)    |
| [@rexeus/typeweaver-aws-cdk](./packages/aws-cdk) | AWS CDK constructs and deployment utilities for TypeWeaver APIs      | ![npm](https://img.shields.io/npm/v/@rexeus/typeweaver-aws-cdk)    |

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

## Plugin System

TypeWeaver uses a plugin-based architecture for extensible code generation. Configure which code to generate based on your needs.

### Built-in Plugins

- **Types Plugin** (`@rexeus/typeweaver-types`) - TypeScript types and Zod validators (included by default)
- **Clients Plugin** (`@rexeus/typeweaver-clients`) - HTTP API client generation
- **AWS CDK Plugin** (`@rexeus/typeweaver-aws-cdk`) - AWS CDK constructs and HTTP API Gateway routers

### Using Plugins

Create a `typeweaver.config.js` file:

```javascript
export default {
  input: './api/definitions',
  output: './api/generated',
  plugins: [
    'clients',
    'aws-cdk'
  ],
  prettier: true,
  clean: true
};
```

Then generate with:

```bash
npx typeweaver generate --config ./typeweaver.config.js
```

### Creating Custom Plugins

```typescript
import { BasePlugin } from '@rexeus/typeweaver-gen';

export class MyPlugin extends BasePlugin {
  name = 'my-plugin';
  version = '1.0.0';
  
  async generate(context) {
    // Your generation logic
  }
}
```

See the [plugin documentation](./packages/gen/README.md) for more details.

## Acknowledgments

Built with:

- [TypeScript](https://github.com/microsoft/TypeScript) - For type safety
- [Zod](https://github.com/colinhacks/zod) - For runtime validation
- [Hono](https://github.com/honojs/hono) - For lightweight web framework
