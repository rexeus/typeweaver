# 🧵✨ @rexeus/typeweaver-hono

[![npm version](https://img.shields.io/npm/v/@rexeus/typeweaver-hono.svg)](https://www.npmjs.com/package/@rexeus/typeweaver-hono)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

Typeweaver is a type-safe HTTP API framework built for API-first development with a focus on
developer experience. Use typeweaver to specify your HTTP APIs in TypeScript and Zod, and generate
clients, validators, routers, and more ✨

## 📝 Hono Plugin

This plugin generates type-safe Hono routers from your typeweaver API definitions. For each
resource, it produces a `<ResourceName>Hono` router class that sets up the routes, validates
requests via the generated validators, and wires your handler methods with full type safety.

---

## 📥 Installation

```bash
# Install the CLI and the plugin as a dev dependency
npm install -D @rexeus/typeweaver @rexeus/typeweaver-hono

# Install the runtime as a dependency
npm install @rexeus/typeweaver-core
```

## 💡 How to use

```bash
npx typeweaver generate --input ./api/definition --output ./api/generated --plugins hono
```

More on the CLI in [@rexeus/typeweaver](https://github.com/rexeus/typeweaver/tree/main/packages/cli/README.md#️-cli).

## 📂 Generated Output

For each resource (e.g., `Todo`) this plugin generates a Hono router class, which handles the
routing and request validation for all operations of the resource. This Hono router class can then
be easily integrated into your Hono application.

Generated files are like `<ResourceName>Hono.ts` – e.g. `TodoHono.ts`.

## 🚀 Usage

Implement your handlers and mount the generated router in a Hono app.

```ts
// api/user-handlers.ts
import type { Context } from "hono";
import { HttpStatusCode } from "@rexeus/typeweaver-core";
import type { IGetUserRequest, GetUserResponse, UserNotFoundErrorResponse } from "./generated";
import { GetUserSuccessResponse } from "./generated";

export class UserHandlers implements UserApiHandler {
    async handleGetUserRequest(request: IGetUserRequest, context: Context): Promise<GetUserResponse> {
      // Symbolic database fetch
      const databaseResult = {} as any;
      if (!databaseResult) {
        // Will be properly handled by the generated router and returned as a 404 response
        return new UserNotFoundErrorResponse({
          statusCode: HttpStatusCode.NotFound,
          header: { "Content-Type": "application/json" },
          body: { message: "User not found" },
        });
      }

      return new GetUserSuccessResponse({
        statusCode: HttpStatusCode.OK,
        header: { "Content-Type": "application/json" },
        body: { id: request.param.userId, name: "Jane", email: "jane@example.com" },
      });
  },
  // Implement other operation handlers: handleCreateUserRequest, ...
}
```

```ts
// api/server.ts
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { UserHono } from "./generated";
import { UserHandlers } from "./user-handlers";

const app = new Hono();
const userHandlers = new UserHandlers();

// Configure the generated router
const userRouter = new UserHono({
  requestHandlers: userHandlers,
  validateRequests: true, // default, validates requests
  handleValidationErrors: true, // default: returns 400 with issues
  handleHttpResponseErrors: true, // default: returns thrown HttpResponse as-is
  handleUnknownErrors: true, // default: returns 500
});

// Mount the router into your Hono app
app.route("/", userRouter);

serve({ fetch: app.fetch, port: 3000 }, () => {
  console.log("Hono server listening on http://localhost:3000");
});
```

### ⚙️ Configuration

`TypeweaverHonoOptions<RequestHandlers>`

- `requestHandlers`: object implementing the generated `<ResourceName>ApiHandler` interface
- `validateRequests` (default: `true`): enable/disable request validation
- `handleValidationErrors`: `true` | `false` | `(err, c) => IHttpResponse`,
  - If `true` (default), returns `400 Bad Request` with validation issues in the body
  - If `false`, lets the error propagate
  - If function, calls the function with the error and context, expects an `IHttpResponse` to
    return, so you can customize the response in the way you want
- `handleHttpResponseErrors`: `true` | `false` | `(err, c) => IHttpResponse`
  - If `true` (default), returns thrown `HttpResponse` as-is, they will be sent as the response
  - If `false`, lets the error propagate, which will likely result in a `500 Internal Server Error`
  - If function, calls the function with the error and context, expects an `IHttpResponse` to
    return, so you can customize the response in the way you want
- `handleUnknownErrors`: `true` | `false` | `(err, c) => IHttpResponse`
  - If `true` (default), returns `500 Internal Server Error` with a generic message
  - If `false`, lets the error propagate and the Hono app can handle it (e.g., via middleware)
  - If function, calls the function with the error and context, expects an `IHttpResponse` to
    return, so you can customize the response in the way you want

You can also pass standard Hono options (e.g. `strict`, `getPath`, etc.) through the same options
object.

## 📄 License

Apache 2.0 © Dennis Wentzien 2025
