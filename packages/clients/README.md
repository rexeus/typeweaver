# @rexeus/typeweaver-clients

HTTP client generators for TypeWeaver API specifications.

## Overview

This plugin generates type-safe HTTP API clients from your TypeWeaver API definitions, providing
end-to-end type safety from API definition to client usage.

## Installation

```bash
npm install @rexeus/typeweaver-clients
```

**Peer Dependencies:**

```bash
npm install @rexeus/typeweaver-core @rexeus/typeweaver-gen
```

## Usage

### CLI

```bash
npx typeweaver generate --input ./api/definitions --output ./api/generated --plugins clients
```

### Configuration File

```javascript
// typeweaver.config.js
export default {
  input: "./api/definitions",
  output: "./api/generated",
  plugins: ["clients"],
};
```

## Generated Output

This plugin generates HTTP API clients for each entity in your API definitions.

### Example Generated Client

For an API definition with a `users` entity, the plugin generates:

```typescript
// UsersClient.ts
import { ApiClient } from "@rexeus/typeweaver-core";
import { GetUserRequestCommand } from "./GetUserRequest";
import { GetUserResponseValidator } from "./GetUserResponseValidator";
// ... other imports

export class UsersClient extends ApiClient {
  public send(command: GetUserRequestCommand): Promise<GetUserResponse>;
  public send(command: CreateUserRequestCommand): Promise<CreateUserResponse>;
  // ... other overloads

  public async send(command: unknown): Promise<unknown> {
    if (command instanceof GetUserRequestCommand) {
      return this.handleGetUser(command);
    }
    if (command instanceof CreateUserRequestCommand) {
      return this.handleCreateUser(command);
    }
    // ... other handlers

    throw new Error(`Unknown command type`);
  }

  private async handleGetUser(command: GetUserRequestCommand): Promise<GetUserResponse> {
    const response = await this.makeRequest(command);
    const validator = new GetUserResponseValidator();
    return validator.validate(response);
  }

  // ... other private handlers
}
```

## Usage Examples

### Basic Usage

```typescript
import { UsersClient } from "./api/generated/users/UsersClient";
import { GetUserRequestCommand } from "./api/generated/users/GetUserRequest";

const client = new UsersClient({
  baseURL: "https://api.example.com",
});

// Type-safe request
const command = new GetUserRequestCommand({
  param: { userId: "123" },
  header: { Authorization: "Bearer token" },
});

try {
  // Fully typed response
  const result = await client.send(command);
  console.log(result.body.name); // Type-safe access
} catch (error) {
  // Typed error handling
  if (error instanceof UserNotFoundErrorResponse) {
    console.error("User not found:", error.body.message);
  }
}
```

### Advanced Configuration

```typescript
import { UsersClient } from "./api/generated/users/UsersClient";

const client = new UsersClient({
  baseURL: "https://api.example.com",
  timeout: 5000,
  headers: {
    "User-Agent": "MyApp/1.0",
  },
  // Custom axios config
  axios: {
    validateStatus: status => status < 500,
  },
});
```

### Error Handling

```typescript
import {
  UsersClient,
  GetUserRequestCommand,
  UserNotFoundErrorResponse,
  ValidationErrorResponse,
} from "./api/generated";

const client = new UsersClient({ baseURL: "https://api.example.com" });

try {
  const result = await client.send(
    new GetUserRequestCommand({
      param: { userId: "invalid-id" },
    })
  );
} catch (error) {
  // Type-safe error handling
  if (error instanceof UserNotFoundErrorResponse) {
    console.error(`User not found: ${error.body.message}`);
  } else if (error instanceof ValidationErrorResponse) {
    console.error("Validation failed:", error.body.issues);
  } else {
    console.error("Unexpected error:", error);
  }
}
```

## Client Features

### Type Safety

- **Request Commands** - Fully typed request objects
- **Response Types** - Typed response interfaces
- **Error Types** - Typed error response classes
- **Parameter Validation** - Runtime validation via Zod

### Method Overloading

Each client provides method overloads for perfect type inference:

```typescript
// Each command type gets its own overload
client.send(getUserCommand); // Returns GetUserResponse
client.send(createUserCommand); // Returns CreateUserResponse
```

### Automatic Validation

- **Request validation** - Commands validate input data
- **Response validation** - Responses validated against schemas
- **Error parsing** - HTTP errors mapped to typed error classes

### Framework Integration

Works with any HTTP client framework (uses Axios by default):

```typescript
// Custom HTTP adapter
const client = new UsersClient({
  baseURL: "https://api.example.com",
  httpAdapter: new FetchAdapter(), // Custom adapter
});
```

## Request Commands

### Command Structure

Generated request commands encapsulate all request data:

```typescript
import { GetUserRequestCommand } from "./GetUserRequest";

const command = new GetUserRequestCommand({
  param: { userId: "123" }, // Path parameters
  query: { include: ["posts"] }, // Query parameters
  header: { Authorization: "Bearer token" }, // Headers
  body: { name: "John Doe" }, // Request body
});
```

### Command Validation

Commands validate input data at construction time:

```typescript
try {
  const command = new GetUserRequestCommand({
    param: { userId: "invalid-uuid" }, // Will throw validation error
  });
} catch (error) {
  console.error("Invalid command:", error.issues);
}
```

## Response Handling

### Success Responses

```typescript
const result = await client.send(command);

// Typed access to response data
console.log(result.statusCode); // HTTP status code
console.log(result.header); // Response headers
console.log(result.body.id); // Response body (fully typed)
```

### Error Responses

```typescript
try {
  const result = await client.send(command);
} catch (error) {
  if (error instanceof UserNotFoundErrorResponse) {
    // Specific error type
    console.log(error.statusCode); // 404
    console.log(error.body.message); // "User not found"
  }
}
```

## Plugin Architecture

This plugin extends the TypeWeaver plugin system:

```typescript
import { BasePlugin, type GeneratorContext } from "@rexeus/typeweaver-gen";

export default class ClientsPlugin extends BasePlugin {
  public name = "clients";

  public override generate(context: GeneratorContext): void {
    // Generates API clients for each entity
  }
}
```

## Best Practices

### Client Configuration

```typescript
// Environment-specific configuration
const client = new UsersClient({
  baseURL: process.env.API_BASE_URL,
  timeout: parseInt(process.env.API_TIMEOUT || "5000"),
  headers: {
    "User-Agent": `${process.env.APP_NAME}/${process.env.APP_VERSION}`,
  },
});
```

### Error Handling Strategy

```typescript
// Centralized error handling
async function handleApiCall<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ValidationErrorResponse) {
      // Log validation issues
      logger.warn("Validation error:", error.body.issues);
    } else if (error instanceof UnauthorizedErrorResponse) {
      // Handle auth errors
      redirectToLogin();
    }
    throw error;
  }
}

// Usage
const result = await handleApiCall(() =>
  client.send(new GetUserRequestCommand({ param: { userId: "123" } }))
);
```

### Testing

```typescript
// Mock clients for testing
import { UsersClient } from "./api/generated";

// Mock the client
jest.mock("./api/generated/users/UsersClient");

const mockClient = new UsersClient() as jest.Mocked<UsersClient>;
mockClient.send.mockResolvedValue({
  statusCode: 200,
  body: { id: "123", name: "Test User" },
});
```

## Integration Examples

### React Hook

```typescript
import { useState, useEffect } from "react";
import { UsersClient, GetUserRequestCommand } from "./api/generated";

const client = new UsersClient({ baseURL: "https://api.example.com" });

export function useUser(userId: string) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchUser() {
      try {
        setLoading(true);
        const result = await client.send(
          new GetUserRequestCommand({
            param: { userId },
          })
        );
        setUser(result.body);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, [userId]);

  return { user, loading, error };
}
```

### Node.js Service

```typescript
import { UsersClient, CreateUserRequestCommand } from "./api/generated";

export class UserService {
  private client = new UsersClient({
    baseURL: process.env.API_BASE_URL,
  });

  async createUser(userData: CreateUserRequest["body"]) {
    const command = new CreateUserRequestCommand({
      body: userData,
      header: {
        Authorization: `Bearer ${process.env.API_TOKEN}`,
      },
    });

    return await this.client.send(command);
  }
}
```

## Troubleshooting

### Common Issues

**Import errors**: Ensure all TypeWeaver plugins are installed **Type errors**: Regenerate code
after API definition changes **Runtime errors**: Check that server API matches generated client
expectations

### Debug Mode

Enable verbose logging:

```typescript
const client = new UsersClient({
  baseURL: "https://api.example.com",
  debug: true, // Enable debug logging
});
```

## License

ISC © Dennis Wentzien 2025
