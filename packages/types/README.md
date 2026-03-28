# 🧵✨ @rexeus/typeweaver-types

[![npm version](https://img.shields.io/npm/v/@rexeus/typeweaver-types.svg)](https://www.npmjs.com/package/@rexeus/typeweaver-types)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

Typeweaver is a type-safe HTTP API framework built for API-first development with a focus on
developer experience. Use typeweaver to specify your HTTP APIs in TypeScript and Zod, and generate
clients, validators, routers, and more ✨

## 📝 Types Plugin

This plugin generates TypeScript types and Zod validators from your typeweaver API definitions,
providing the foundation for type-safe API development. This is the core plugin that's included by
default in every typeweaver generation.

---

## 📥 Installation

```bash
# Install the CLI as a dev dependency
# Types plugin will be automatically included
npm install -D @rexeus/typeweaver

# Install the runtime as a dependency
npm install @rexeus/typeweaver-core
```

## 💡 How to use

This plugin is included by default and doesn't need to be explicitly specified:

```bash
# Generate with clients + types plugins
npx typeweaver generate --input ./api/spec/index.ts --output ./api/generated --plugins clients
```

More details on how to use the
[CLI](https://github.com/rexeus/typeweaver/tree/main/packages/cli/README.md#️-cli).

## 📂 Generated Output

For each operation (e.g., `CreateTodo`), the plugin generates four main files:

- `<OperationId>Request.ts`
- `<OperationId>Response.ts`
- `<OperationId>RequestValidator.ts`
- `<OperationId>ResponseValidator.ts`

These files contain the necessary types and validators for requests and responses. All of these
provided types and factory functions are exported.

### 📨 Request Types

All request-related types for an operation are defined in one file: `<OperationId>Request.ts`, e.g.
`CreateTodoRequest.ts`. This file contains:

- **`I<OperationId>RequestHeader`** - Type of request headers, if defined, e.g.
  `ICreateTodoRequestHeader`
- **`I<OperationId>RequestPath`** - Type for path parameters, if defined, e.g.
  `ICreateTodoRequestPath`
- **`I<OperationId>RequestQuery`** - Type for query parameters, if defined, e.g.
  `ICreateTodoRequestQuery`
- **`I<OperationId>RequestBody`** - Type for request body, if defined, e.g. `ICreateTodoRequestBody`
- **`I<OperationId>Request`** - Complete request interface combining path, method, headers, and
  body, e.g. `ICreateTodoRequest`
- **`Successful<OperationId>Response`** - Union type excluding error responses for success-only
  handling

### 📬 Response Types

All response-related types for an operation are defined in one file: `<OperationId>Response.ts`,
e.g. `CreateTodoResponse.ts`. This file contains for each response defined inline in an operation:

- **`I<ResponseName>ResponseHeader`** - Type for success response headers, if defined, e.g.
  `ICreateTodoSuccessResponseHeader`
- **`I<ResponseName>ResponseBody`** - Type for success response payload structure, if defined, e.g.
  `ICreateTodoSuccessResponseBody`
- **`I<ResponseName>Response`** - Typed response object using `ITypedHttpResponse<TType, TStatusCode, THeader, TBody>`, e.g.
  `ICreateTodoSuccessResponse`
- **`create<ResponseName>Response`** - Factory function that creates a typed response object, e.g.
  `createCreateTodoSuccessResponse`

Furthermore, a union type is generated, which includes all possible responses (success + error), not
only those defined inline in the operation:

- **`<OperationId>Response`** - Union type of all `I`-prefixed response types, e.g.
  `CreateTodoResponse` which is a union of `ICreateTodoSuccessResponse | IForbiddenErrorResponse | ...`

### 📨✓ Request Validators

Request validation logic for an operation is defined in one file:
`<OperationId>RequestValidator.ts`, e.g. `CreateTodoRequestValidator.ts`. This file contains:

- **`<OperationId>RequestValidator`** - Main validation class extending `RequestValidator`, e.g.
  `CreateTodoRequestValidator`
- **`safeValidate()`** - Non-throwing validation method returning `SafeRequestValidationResult`
- **`validate()`** - Throwing validation method that returns validated request or throws
  `RequestValidationError`
- **Header coercion logic** - Automatic conversion of headers to schema-appropriate types (single
  string value & multi string value headers)
- **Query parameter coercion logic** - Automatic conversion of query parameters to
  schema-appropriate types (single string value & multi string value query parameters)
- **Request validation errors** - Includes all issues related to the incoming request for headers,
  query parameters, and body.
- **Unknown property filtering** - Automatically removes properties not defined in the request
  schema. If a request exceeds the definition, it is not rejected directly.

**Using the generated request validators**

```typescript
import {
  RequestValidationError,
  type IHttpRequest,
} from "@rexeus/typeweaver-core";
import { CreateTodoRequestValidator } from "path/to/generated/output";

const requestValidator = new CreateTodoRequestValidator();

// A request in structure of IHttpRequest
const request: IHttpRequest = {
  // ...
};

// Using safe validation
const safeResult = requestValidator.safeValidate(request);
if (safeResult.isValid) {
  console.log("Request is valid", safeResult.data);
} else {
  // Error is instance of RequestValidationError class
  console.log("Request is invalid", safeResult.error);
}

// Using throwing validation
try {
  const validatedRequest = requestValidator.validate(request);
  console.log("Request is valid", validatedRequest);
} catch (error) {
  if (error instanceof RequestValidationError) {
    console.log("Request is invalid", error);
  }
}
```

### 📬✓ Response Validators

Response validation logic for an operation is defined in one file:
`<OperationId>ResponseValidator.ts`, e.g. `CreateTodoResponseValidator.ts`. This file contains:

- **`<OperationId>ResponseValidator`** - Main validation class extending `ResponseValidator`, e.g.
  `CreateTodoResponseValidator`
- **`safeValidate()`** - Non-throwing validation method returning `SafeResponseValidationResult`
- **`validate()`** - Throwing validation method that returns validated response or throws
  ResponseValidationError
- Valid response data is a typed response object matching one of the generated response types
- **Header coercion logic** - Automatic conversion of headers to schema-appropriate types (single
  string value & multi string value headers)
- **Response validation errors** - Include details about the issues with all possible responses for
  the given status code:
  - An issue for a possible response includes details about header and body issues
  - If the given status code is not specified in the operation at all an issue with details about
    expected status codes is included
- **Unknown property filtering** - Automatically removes properties not defined in the response
  schema. If a response exceeds the definition, it is not rejected directly.

**Using the generated response validators**

```typescript
import {
  ResponseValidationError,
  type IHttpResponse,
} from "@rexeus/typeweaver-core";
import { CreateTodoResponseValidator } from "path/to/generated/output";

const responseValidator = new CreateTodoResponseValidator();

// A response in structure of IHttpResponse
const response: IHttpResponse = {
  // ...
};

// Using safe validation
const safeResult = responseValidator.safeValidate(response);
if (safeResult.isValid) {
  console.log("Response is valid", safeResult.data);

  // Data is a typed response object — use the type discriminator to narrow
  if (safeResult.data.type === "CreateTodoSuccess") {
    // handle CreateTodoSuccessResponse
  }
  if (safeResult.data.type === "InternalServerError") {
    // handle InternalServerErrorResponse
  }
  // handle other response types ...
} else {
  // Error is instance of ResponseValidationError class
  console.log("Response is invalid", safeResult.error);
}

// Using throwing validation
try {
  const validatedResponse = responseValidator.validate(response);
  console.log("Response is valid", validatedResponse);

  // Same here: use the type discriminator to narrow
  if (validatedResponse.type === "CreateTodoSuccess") {
    // handle CreateTodoSuccessResponse
  }
  // ... handle other response types
} catch (error) {
  if (error instanceof ResponseValidationError) {
    console.log("Response is invalid", error);
  }
}
```

## 📄 License

Apache 2.0 © Dennis Wentzien 2026
