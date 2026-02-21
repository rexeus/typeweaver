# 🧵✨ @rexeus/typeweaver-clients

[![npm version](https://img.shields.io/npm/v/@rexeus/typeweaver-clients.svg)](https://www.npmjs.com/package/@rexeus/typeweaver-clients)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

Typeweaver is a type-safe HTTP API framework built for API-first development with a focus on
developer experience. Use typeweaver to specify your HTTP APIs in TypeScript and Zod, and generate
clients, validators, routers, and more ✨

## 📝 Clients Plugin

This plugin generates type-safe HTTP clients from your typeweaver API definitions, providing
end-to-end type safety. The generated clients use the Command Pattern, where each API request is
encapsulated as a typed command object that contains all request data and handles response
processing.

## 📥 Installation

```bash
# Install the CLI and the plugin as a dev dependency
npm install -D @rexeus/typeweaver @rexeus/typeweaver-clients

# Install the runtime as a dependency
npm install @rexeus/typeweaver-core
```

## 💡 How to use

```bash
npx typeweaver generate --input ./api/definitions --output ./api/generated --plugins clients
```

More on the CLI in [@rexeus/typeweaver](https://github.com/rexeus/typeweaver/tree/main/packages/cli/README.md#️-cli).

## 📂 Generated Output

For each resource (e.g., `Todo`), the plugin generates a HTTP client. This client can execute
request commands for all operations of this resource. This plugin generates the following files:

- `<ResourceName>Client.ts` - e.g. `TodoClient.ts`
- `<OperationId>RequestCommand.ts` - e.g. `CreateTodoRequestCommand.ts`

### 📡 Clients

Resource-specific HTTP clients are generated as `<ResourceName>Client.ts` files, e.g.
`TodoClient.ts`. Each client extends the `ApiClient` base class and provides:

- **Type-safe HTTP methods** - Method overloads for each operation ensuring compile-time type
  checking
- **fetch based** - Zero dependencies, uses the native fetch API. Supports custom fetch functions for middleware and testing
- **Response type mapping** - Each response is automatically mapped to the associated response class
  and an instance of the class is returned. This ensures that all responses are in the defined
  format and it is type-safe.
- **Unknown response handling**
  - Unknown properties are automatically removed from the response. If a response exceeds the
    definition, it is not rejected directly.
  - If a response does not match any known format, it will be rejected by default as an
    `UnknownResponse` instance.
  - This unknown response handling can be configured. It is also possible for an `UnknownResponse`
    instance to be created without being thrown.

**Using generated clients**

```typescript
import { TodoClient } from "path/to/generated/output";

const client = new TodoClient({
  fetchFn: customFetch, // Custom fetch function (optional, defaults to globalThis.fetch)
  baseUrl: "https://api.example.com", // Base URL for all requests (required)
  unknownResponseHandling: "throw", // "throw" | "passthrough" for unknown responses
  // -> In "passthrough" mode, the received status code determines if the response is thrown
  isSuccessStatusCode: code => code < 400, // Custom success status code predicate, determines whether the response is successful or should be thrown
});
```

### ✉️ Request Commands

Request commands are generated as `<OperationId>RequestCommand.ts` files, e.g.
`CreateTodoRequestCommand.ts`. These commands encapsulate all request data and provide:

- **Type-safe construction** - Constructor enforces correct request structure
- **Complete request encapsulation** - Contains method, path, headers, query parameters, and body
- **Response processing** - Transform raw HTTP responses into typed response objects of the correct
  response class

### Basic Usage

```typescript
import {
  TodoClient,
  CreateTodoRequestCommand,
  CreateTodoSuccessResponse,
  OtherSuccessResponse,
  ValidationErrorResponse,
  InternalServerErrorResponse,
} from "path/to/generated/output";

const client = new TodoClient({
  baseUrl: "https://api.example.com",
});

const command = new CreateTodoRequestCommand({
  header: { Authorization: "Bearer token" },
  body: { title: "New Todo", status: "PENDING" },
});

try {
  const response = await client.send(command);

  // If there is only one success response,
  // you can directly access the response like:
  console.log("Success:", response.body);

  // If there are multiple success responses, you can check the instance like:
  if (response instanceof CreateTodoSuccessResponse) {
    console.log("Todo created successfully:", response.body);
  }
  if (response instanceof OtherSuccessResponse) {
    // ... Handle "OtherSuccessResponse"
  }
  // ...
} catch (error) {
  if (error instanceof ValidationErrorResponse) {
    // Handle validation errors
  }
  if (error instanceof InternalServerErrorResponse) {
    // Handle internal server errors
  }
  // ... Handle other errors
}
```

## 📄 License

Apache 2.0 © Dennis Wentzien 2025
