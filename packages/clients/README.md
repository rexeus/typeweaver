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
npx typeweaver generate --input ./api/spec/index.ts --output ./api/generated --plugins clients
```

More on the CLI in
[@rexeus/typeweaver](https://github.com/rexeus/typeweaver/tree/main/packages/cli/README.md#️-cli).

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
- **fetch based** - Zero dependencies, uses the native fetch API. Supports custom fetch functions
  for middleware and testing
- **Response type mapping** - Each response is automatically mapped to the associated typed response
  object. This ensures that all responses are in the defined format and it is type-safe.
- **Unknown response handling**
  - Unknown properties are automatically removed from the response. If a response exceeds the
    definition, it is not rejected directly.

**Using generated clients**

```typescript
import { TodoClient } from "path/to/generated/output";

const client = new TodoClient({
  fetchFn: customFetch, // Custom fetch function (optional, defaults to globalThis.fetch)
  baseUrl: "https://api.example.com", // Base URL for all requests (required)
  timeoutMs: 30_000, // Request timeout in milliseconds (optional)
});
```

### ✉️ Request Commands

Request commands are generated as `<OperationId>RequestCommand.ts` files, e.g.
`CreateTodoRequestCommand.ts`. These commands encapsulate all request data and provide:

- **Type-safe construction** - Constructor enforces correct request structure
- **Complete request encapsulation** - Contains method, path, headers, query parameters, and body
- **Response processing** - Transform raw HTTP responses into typed response objects

### Basic Usage

```typescript
import { TodoClient, CreateTodoRequestCommand } from "path/to/generated/output";

const client = new TodoClient({
  baseUrl: "https://api.example.com",
});

const command = new CreateTodoRequestCommand({
  header: { Authorization: "Bearer token" },
  body: { title: "New Todo", status: "PENDING" },
});

const response = await client.send(command);

// Use the type discriminator to narrow the response type
if (response.type === "CreateTodoSuccess") {
  console.log("Todo created successfully:", response.body);
} else if (response.type === "ValidationError") {
  // Handle validation errors
} else if (response.type === "InternalServerError") {
  // Handle internal server errors
}
// ... Handle other response types
```

## 📄 License

Apache 2.0 © Dennis Wentzien 2026
