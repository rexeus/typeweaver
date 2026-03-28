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
npx typeweaver generate --input ./api/spec/index.ts --output ./api/generated --plugins hono
```

More on the CLI in
[@rexeus/typeweaver](https://github.com/rexeus/typeweaver/tree/main/packages/cli/README.md#️-cli).

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
import type { HonoUserApiHandler, IGetUserRequest, GetUserResponse } from "./generated";
import { createUserNotFoundErrorResponse, createGetUserSuccessResponse } from "./generated";

export class UserHandlers implements HonoUserApiHandler {
  async handleGetUserRequest(request: IGetUserRequest, context: Context): Promise<GetUserResponse> {
    const user = await db.findUser(request.param.userId);
    if (!user) {
      return createUserNotFoundErrorResponse({
        header: { "Content-Type": "application/json" },
        body: { message: "User not found" },
      });
    }

    return createGetUserSuccessResponse({
      header: { "Content-Type": "application/json" },
      body: {
        id: request.param.userId,
        name: "Jane",
        email: "jane@example.com",
      },
    });
  }
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
  validateResponses: true, // default, validates responses and strips extra fields
  handleRequestValidationErrors: true, // default: returns 400 with issues
  handleResponseValidationErrors: true, // default: returns 500
  handleHttpResponseErrors: true, // default: returns thrown typed HTTP responses as-is
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

- `requestHandlers`: object implementing the generated `Hono<ResourceName>ApiHandler` type
- `validateRequests` (default: `true`): enable/disable request validation
- `validateResponses` (default: `true`): enable/disable response validation. When enabled, responses
  are validated against the operation's schema and extra body fields are stripped before sending.
- `handleRequestValidationErrors`: `true` | `false` |
  `(err, c) => IHttpResponse | Promise<IHttpResponse>`
  - If `true` (default), returns `400 Bad Request` with validation issues in the body
  - If `false`, disables this handler (errors fall through to the unknown error handler)
  - If function, calls the function with the error and context, expects an `IHttpResponse` to
    return, so you can customize the response in the way you want
- `handleResponseValidationErrors`: `true` | `false` |
  `(err, response, c) => IHttpResponse | Promise<IHttpResponse>`
  - If `true` (default), returns `500 Internal Server Error`
  - If `false`, disables response validation error handling — the invalid response is returned
    as-is. Validation still runs (and strips extra fields on valid responses), but invalid responses
    pass through unchanged. Useful when you want field stripping without blocking invalid responses.
  - If function, calls the function with the `ResponseValidationError`, the original (invalid)
    response, and the Hono context. The function should return an `IHttpResponse`. If the custom
    handler throws, the original response is returned as a fallback.
- `handleHttpResponseErrors`: `true` | `false` |
  `(err, c) => IHttpResponse | Promise<IHttpResponse>`
  - If `true` (default), returns thrown typed HTTP responses (`ITypedHttpResponse`) as-is, they will
    be sent as the response
  - If `false`, disables this handler (errors fall through to the unknown error handler)
  - If function, calls the function with the error and context, expects an `IHttpResponse` to
    return, so you can customize the response in the way you want
- `handleUnknownErrors`: `true` | `false` | `(err, c) => IHttpResponse | Promise<IHttpResponse>`
  - If `true` (default), returns `500 Internal Server Error` with a generic message
  - If `false`, disables this handler (errors propagate to Hono's error handling, e.g. via
    `app.onError`)
  - If function, calls the function with the error and context, expects an `IHttpResponse` to
    return, so you can customize the response in the way you want

You can also pass standard Hono options (e.g. `strict`, `getPath`, etc.) through the same options
object.

## 📄 License

Apache 2.0 © Dennis Wentzien 2026
