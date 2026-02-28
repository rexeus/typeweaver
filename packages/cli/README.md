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
| [@rexeus/typeweaver-hono](https://github.com/rexeus/typeweaver/tree/main/packages/hono/README.md)       | Plugin for Hono routers                                                                                     | ![npm](https://img.shields.io/npm/v/@rexeus/typeweaver-hono)    |
| [@rexeus/typeweaver-aws-cdk](https://github.com/rexeus/typeweaver/tree/main/packages/aws-cdk/README.md) | Plugin for AWS CDK constructs for API Gateway V2                                                            | ![npm](https://img.shields.io/npm/v/@rexeus/typeweaver-aws-cdk) |

More plugins are planned. If you want to build your own, check out the plugin system

[Plugin system](https://github.com/rexeus/typeweaver/tree/main/packages/gen/README.md#-how-to-use).

---

## ⌨️ CLI

Generate TypeScript code from your API definitions:

```bash
# Node.js (npm)
npx typeweaver generate --input ./api/definition --output ./api/generated --plugins clients

# Node.js (pnpm)
pnpx typeweaver generate --input ./api/definition --output ./api/generated --plugins clients

# Deno
deno run -A npm:@rexeus/typeweaver generate --input ./api/definition --output ./api/generated --plugins clients

# Bun
bunx typeweaver generate --input ./api/definition --output ./api/generated --plugins clients
```

> **Note**: Deno may require the `--sloppy-imports` flag or equivalent configuration in `deno.json`
> when your API definitions use extensionless TypeScript imports.

### ⚙️ Options

- `--input, -i <path>`: Input directory containing API definitions (required)
- `--output, -o <path>`: Output directory for generated code (required)
- `-s, --shared <path>`: Shared directory for reusable schemas (optional, defaults to
  `<input-path>/shared`)
- `--config, -c <path>`: Configuration file path (optional)
- `--plugins, -p <plugins>`: Comma-separated list of plugins to use (e.g., "clients,hono" or "all"
  for all plugins)
- `--format / --no-format`: Enable/disable code formatting with oxfmt (default: true)
- `--clean / --no-clean`: Enable/disable output directory cleaning (default: true)

### 📝 Configuration File

Create a config file (e.g. `typeweaver.config.js`) for more complex configurations:

```javascript
export default {
  input: "./api/definition",
  output: "./api/generated",
  plugins: ["clients", "hono", "aws-cdk"],
  format: true,
  clean: true,
};
```

Then run:

```bash
npx typeweaver generate --config ./typeweaver.config.js
```

> Replace `npx` with `pnpx`, `deno run -A npm:@rexeus/typeweaver`, or `bunx` depending on your
> runtime.

## 🌱 Get Started

### 📁 Project Structure

Your API definition must follow this structure:

- Each resource needs its own directory under the specified input directory (e.g. input dir:
  `api/definition` contains `user/`, `post/` subdirectories)
  - The directory name defines the resource name (e.g. `user`, `post`)
  - The structure inside a resource directory can be nested to provide better organization (e.g.
    `user/errors/...`, `user/mutations/...`)
- Inside a resource directory, each operation or response definition gets its own file (e.g.
  `CreateUserDefinition.ts`, `UserNotFoundErrorDefinition.ts`)
- An operation definition file must include one default export of a `HttpOperationDefinition`
  instance (e.g. `export default new HttpOperationDefinition({...})`)
- It is recommended to specify separate schemas for requests and responses, but this is not strictly
  required.
  - If separating schemas, Zod utilities can be used to apply general schemas case-specifically
    (useful Zod utilities: pick, omit, merge...)
- A response definition file must include one default export of a `HttpResponseDefinition` instance
  (e.g. `export default new HttpResponseDefinition({...})`)
- Responses shared across operations are possible, but need to be placed in the `shared` directory.
  - The shared directory can be specified using the `--shared` option, but must be located within
    the input directory
  - Default shared directory is `<input-path>/shared`
  - The shared directory is suitable not only as a place for responses but also for shared schemas

As you can see, the structure of the input directory is essential. However, you are completely free
to choose the structure and nesting within resource directories.

**Important**: All definition files and their dependencies (like separate schemas etc.) must be
self-contained within the input directory. Generated code creates an immutable snapshot of your
definitions, so any external imports (relative imports outside the input directory) will not work.
NPM package imports continue to work normally.

```
api/definition/
├── user/                                  # Resource directory
│   ├── errors/                            # Resource-specific error definitions
│   │   │                                  # -> Because they are inside a resource directory,
│   │   │                                  # they can only be used within this resource
│   │   └── UserNotFoundErrorDefinition.ts
│   │   └── UserStatusTransitionInvalidErrorDefinition.ts
│   ├── CreateUserDefinition.ts            # Operation definitions
│   ├── GetUserDefinition.ts
│   ├── ListUserDefinition.ts
│   ├── UpdateUserDefinition.ts
│   └── userSchema.ts                      # Schema for the resource, can be reused across operations
├── post/
│   ├── errors/
│   ├── CreatePostDefinition.ts
│   ├── GetPostDefinition.ts
│   ├── ...
├── ...
└── shared/                                # Shared responses and schemas
   │                                       # -> While it doesn't matter where schemas are defined
   │                                       # inside the input directory, responses can only be
   │                                       # shared across resources if they are located in the
   │                                       # shared directory
   ├── ConflictErrorDefinition.ts
   ├── ForbiddenErrorDefinition.ts
   ├── InternalServerErrorDefinition.ts
   ├── NotFoundErrorDefinition.ts          # Like BaseApiErrors, can be extended to be resource-specific
   ├── TooManyRequestsErrorDefinition.ts
   ├── UnauthorizedErrorDefinition.ts
   ├── ValidationErrorDefinition.ts
   └── sharedResponses.ts                  # Collection of responses relevant for every operation
```

### 💻 Sample Definitions

```typescript
// api/definition/user/userSchema.ts
import { z } from "zod";

// General schema for user status
export const userStatusSchema = z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]);

// General user schema, can be reused across operations
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
// api/definition/user/GetUserDefinition.ts
import { HttpOperationDefinition, HttpMethod, HttpStatusCode } from "@rexeus/typeweaver-core";
import { z } from "zod";
import { sharedResponses } from "../shared/sharedResponses";
import { userSchema } from "./userSchema";
import UserNotFoundErrorDefinition from "./errors/UserNotFoundErrorDefinition";

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
    // - the only success response in this operation is defined inline
    // - the response could also be defined in a separate file and be imported here
    // - generally also multiple success responses could be defined
    // - in this case the "general" user schema is imported and used
    {
      statusCode: HttpStatusCode.OK,
      description: "User successfully retrieved",
      header: z.object({
        "Content-Type": z.literal("application/json"),
      }),
      body: userSchema,
    },
    UserNotFoundErrorDefinition, // Resource specific response
    ...sharedResponses, // Commonly used responses across all operations, e.g. 401, 403, 500...
  ],
});
```

```typescript
// api/definition/user/UpdateUserDefinition.ts
import { HttpOperationDefinition, HttpMethod, HttpStatusCode } from "@rexeus/typeweaver-core";
import { z } from "zod";
import { sharedResponses } from "../shared/sharedResponses";
import { userSchema } from "./userSchema";
import UserNotFoundErrorDefinition from "./errors/UserNotFoundErrorDefinition";
import UserStatusTransitionInvalidErrorDefinition from "./errors/UserStatusTransitionInvalidErrorDefinition";

export default new HttpOperationDefinition({
  operationId: "UpdateUser",
  method: HttpMethod.PATCH,
  path: "/users/:userId",
  request: {
    param: z.object({
      userId: z.uuid(),
    }),
    // general user schema is processed via zod's pick and partial methods
    // to match the update operation's requirements
    body: userSchema
      .pick({
        name: true,
        email: true,
        status: true,
      })
      .partial(),
  },
  responses: [
    {
      statusCode: HttpStatusCode.OK,
      description: "User successfully updated",
      header: z.object({
        "Content-Type": z.literal("application/json"),
      }),
      body: userSchema,
    },
    UserNotFoundErrorDefinition, // Resource specific response
    UserStatusTransitionInvalidErrorDefinition, // Resource specific response
    ...sharedResponses, // Commonly used responses across all operations, e.g. 401, 403, 500...
  ],
});
```

```typescript
// api/definition/user/errors/UserNotFoundErrorDefinition.ts
import { z } from "zod";
import { NotFoundErrorDefinition } from "../../shared";

// - uses the shared NotFoundErrorDefinition as "base" and extends it
// - adds a specific message and code for the user resource
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

```typescript
// api/definition/user/errors/UserStatusTransitionInvalidErrorDefinition.ts
import { HttpResponseDefinition, HttpStatusCode } from "@rexeus/typeweaver-core";
import { z } from "zod";
import { userStatusSchema } from "../userSchema";

// could also extend the shared ConflictErrorDefinition:
// export default ConflictErrorDefinition.extend({...});

// or in this case does not extend a BaseApiError and defines everything itself
export default new HttpResponseDefinition({
  name: "UserStatusTransitionInvalidError",
  description: "User status transition is conflicting with current status",
  body: z.object({
    message: z.literal("User status transition is conflicting with current status"),
    code: z.literal("USER_STATUS_TRANSITION_INVALID_ERROR"),
    context: z.object({
      userId: z.uuid(),
      currentStatus: userStatusSchema,
    }),
    actualValues: z.object({
      requestedStatus: userStatusSchema,
    }),
    expectedValues: z.object({
      allowedStatuses: z.array(userStatusSchema),
    }),
  }),
});
```

```typescript
// api/definition/shared/sharedResponses.ts
import ForbiddenErrorDefinition from "./ForbiddenErrorDefinition";
import InternalServerErrorDefinition from "./InternalServerErrorDefinition";
import TooManyRequestsErrorDefinition from "./TooManyRequestsErrorDefinition";
import UnauthorizedErrorDefinition from "./UnauthorizedErrorDefinition";
import UnsupportedMediaTypeErrorDefinition from "./UnsupportedMediaTypeErrorDefinition";
import ValidationErrorDefinition from "./ValidationErrorDefinition";

// various error responses which are relevant for every operation
// can be spread in the responses array of an HttpOperationDefinition
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
npx typeweaver generate --input ./api/definition --output ./api/generated --plugins clients,hono
```

### 🌐 Create Hono web server

```typescript
// api/user-handlers.ts
import { HttpResponse, HttpStatusCode } from "@rexeus/typeweaver-core";
import {
  type UserApiHandler,
  type IGetUserRequest,
  GetUserResponse,
  GetUserSuccessResponse,
  type ICreateUserRequest,
  CreateUserResponse,
  type IUpdateUserRequest,
  UpdateUserResponse,
  type IListUserRequest,
  ListUserResponse,
} from "./generated";

export class UserHandlers implements UserApiHandler {
  public constructor() {}

  public async handleGetUserRequest(request: IGetUserRequest): Promise<GetUserResponse> {
    // Simulate fetching user data
    const fetchedUser = {
      id: request.param.userId,
      name: "John Doe",
      email: "john.doe@example.com",
      status: "ACTIVE",
      createdAt: new Date("2023-01-01").toISOString(),
      updatedAt: new Date("2023-01-01").toISOString(),
    };

    return new GetUserSuccessResponse({
      statusCode: HttpStatusCode.OK,
      header: {
        "Content-Type": "application/json",
      },
      body: fetchedUser,
    });
  }

  public handleCreateUserRequest(request: ICreateUserRequest): Promise<CreateUserResponse> {
    throw new Error("Not implemented");
  }

  public handleUpdateUserRequest(request: IUpdateUserRequest): Promise<UpdateUserResponse> {
    throw new Error("Not implemented");
  }

  public handleListUserRequest(request: IListUserRequest): Promise<ListUserResponse> {
    throw new Error("Not implemented");
  }
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
import { UserClient, GetUserRequestCommand, UserNotFoundErrorResponse } from "./generated";

const client = new UserClient({ baseUrl: "http://localhost:3000" });

try {
  const getUserRequestCommand = new GetUserRequestCommand({ param: { userId: "123" } });
  const result = await client.send(getUserRequestCommand);

  console.log("Successfully fetched user:", result.body);
} catch (error) {
  if (error instanceof UserNotFoundErrorResponse) {
    console.error("User not found:", error.body);
  } else {
    console.error("Other error occurred:", error);
  }
}
```

```bash
# Call your created Hono server
tsx api/client-test.ts
```

## 📄 License

Apache 2.0 © Dennis Wentzien 2026
