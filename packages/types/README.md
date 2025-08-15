# @rexeus/typeweaver-types

TypeScript type and Zod validator generators for typeweaver APIs.

## Overview

This plugin generates TypeScript types and Zod validators from your typeweaver API definitions,
providing the foundation for type-safe API development. This is the core plugin that's included by
default in typeweaver.

## Installation

```bash
npm install @rexeus/typeweaver-types
```

**Peer Dependencies:**

```bash
npm install @rexeus/typeweaver-core @rexeus/typeweaver-gen
```

## Usage

This plugin is included by default and doesn't need to be explicitly specified:

```bash
npx typeweaver generate --input ./api/definitions --output ./api/generated
```

You can also explicitly include it with other plugins:

```bash
npx typeweaver generate --input ./api/definitions --output ./api/generated --plugins types,clients,aws-cdk
```

## Generated Output

This plugin generates comprehensive TypeScript types and validators for each API operation.

### Generated Files per Operation

For each operation (e.g., `GetUser`), the plugin generates:

1. **Request Types** (`GetUserRequest.ts`)
2. **Response Types** (`GetUserResponse.ts`)
3. **Request Validators** (`GetUserRequestValidator.ts`)
4. **Response Validators** (`GetUserResponseValidator.ts`)

### Shared Response Types

For shared error responses, generates:

- **Shared Response Types** (in `shared/` directory)

## Example Generated Code

### Request Types

```typescript
// GetUserRequest.ts
import { HttpRequest } from "@rexeus/typeweaver-core";
import { z } from "zod/v4";

export const GetUserRequestSchema = z.object({
  param: z.object({
    userId: z.string().uuid(),
  }),
  header: z
    .object({
      Authorization: z.string(),
      Accept: z.literal("application/json"),
    })
    .optional(),
});

export type GetUserRequest = z.infer<typeof GetUserRequestSchema>;

export interface IGetUserRequest extends HttpRequest {
  param: {
    userId: string;
  };
  header?: {
    Authorization: string;
    Accept: "application/json";
  };
}

export class GetUserRequestCommand {
  constructor(public readonly data: IGetUserRequest) {
    GetUserRequestSchema.parse(data);
  }
}
```

### Response Types

```typescript
// GetUserResponse.ts
import { HttpResponse } from "@rexeus/typeweaver-core";
import { z } from "zod/v4";

// Success Response
export const GetUserSuccessResponseSchema = z.object({
  statusCode: z.literal(200),
  header: z.object({
    "Content-Type": z.literal("application/json"),
  }),
  body: z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string().email(),
  }),
});

export type GetUserSuccessResponse = z.infer<typeof GetUserSuccessResponseSchema>;

// Error Responses
export type GetUserErrorResponse =
  | UserNotFoundErrorResponse
  | ValidationErrorResponse
  | InternalServerErrorResponse;

// Union Type
export type GetUserResponse = GetUserSuccessResponse | GetUserErrorResponse;

export interface IGetUserResponse extends HttpResponse {
  statusCode: 200 | 404 | 400 | 500;
  header: {
    "Content-Type": "application/json";
  };
  body:
    | {
        id: string;
        name: string;
        email: string;
      }
    | {
        message: string;
        code: string;
      };
}
```

### Request Validators

```typescript
// GetUserRequestValidator.ts
import { RequestValidator } from "@rexeus/typeweaver-core";
import { GetUserRequestSchema } from "./GetUserRequest";

export class GetUserRequestValidator extends RequestValidator<typeof GetUserRequestSchema> {
  constructor() {
    super(GetUserRequestSchema);
  }

  public validate(request: unknown): GetUserRequest {
    return this.schema.parse(request);
  }

  public safeValidate(request: unknown): SafeParseResult<GetUserRequest> {
    return this.schema.safeParse(request);
  }
}
```

### Response Validators

```typescript
// GetUserResponseValidator.ts
import { ResponseValidator } from "@rexeus/typeweaver-core";
import { GetUserResponse } from "./GetUserResponse";

export class GetUserResponseValidator extends ResponseValidator {
  public validate(response: unknown): GetUserResponse {
    const statusCode = (response as any)?.statusCode;

    switch (statusCode) {
      case 200:
        return this.validateSuccessResponse(response);
      case 404:
        return this.validateUserNotFoundError(response);
      case 400:
        return this.validateValidationError(response);
      case 500:
        return this.validateInternalServerError(response);
      default:
        throw new ResponseValidationError(`Unexpected status code: ${statusCode}`);
    }
  }

  private validateSuccessResponse(response: unknown): GetUserSuccessResponse {
    return GetUserSuccessResponseSchema.parse(response);
  }

  // ... other validation methods
}
```

## Type Features

### Complete Type Safety

- **Request Types** - Fully typed request interfaces
- **Response Types** - Union types for all possible responses
- **Parameter Types** - Path, query, header, and body parameters
- **Validation Types** - Runtime validation with Zod schemas

### Zod Integration

- **Schema Generation** - Automatic Zod schema creation
- **Runtime Validation** - Type-safe validation at runtime
- **Error Handling** - Structured validation errors
- **Type Inference** - TypeScript types inferred from Zod schemas

### Error Response Handling

```typescript
// Shared error responses are reused across operations
export type UserNotFoundErrorResponse = {
  statusCode: 404;
  body: {
    message: "User not found";
    code: "USER_NOT_FOUND";
    userId: string;
  };
};

// Operation-specific error handling
export type GetUserErrorResponse =
  | UserNotFoundErrorResponse
  | ValidationErrorResponse
  | InternalServerErrorResponse;
```

## Usage Examples

### Request Validation

```typescript
import { GetUserRequestValidator } from "./api/generated";

const validator = new GetUserRequestValidator();

try {
  const validatedRequest = validator.validate({
    param: { userId: "123e4567-e89b-12d3-a456-426614174000" },
    header: { Authorization: "Bearer token" },
  });

  // validatedRequest is fully typed
  console.log(validatedRequest.param.userId);
} catch (error) {
  console.error("Validation failed:", error.issues);
}
```

### Response Validation

```typescript
import { GetUserResponseValidator } from "./api/generated";

const validator = new GetUserResponseValidator();

try {
  const validatedResponse = validator.validate({
    statusCode: 200,
    header: { "Content-Type": "application/json" },
    body: { id: "123", name: "John", email: "john@example.com" },
  });

  // Response is typed based on status code
  if (validatedResponse.statusCode === 200) {
    console.log(validatedResponse.body.name); // Type-safe access
  }
} catch (error) {
  console.error("Response validation failed:", error);
}
```

### Type Guards

```typescript
import { GetUserResponse } from "./api/generated";

function isSuccessResponse(response: GetUserResponse): response is GetUserSuccessResponse {
  return response.statusCode === 200;
}

function handleResponse(response: GetUserResponse) {
  if (isSuccessResponse(response)) {
    // TypeScript knows this is a success response
    console.log(response.body.name);
  } else {
    // TypeScript knows this is an error response
    console.error(response.body.message);
  }
}
```

## Integration with Other Plugins

### With Clients Plugin

The types plugin provides the foundation for type-safe clients:

```typescript
// Generated by types plugin
import { GetUserRequestCommand, GetUserResponse } from "./GetUserRequest";
import { GetUserResponseValidator } from "./GetUserResponseValidator";

// Used by clients plugin
export class UsersClient {
  async send(command: GetUserRequestCommand): Promise<GetUserResponse> {
    const response = await this.makeRequest(command);
    const validator = new GetUserResponseValidator();
    return validator.validate(response);
  }
}
```

### With AWS CDK Plugin

Types provide the foundation for request/response handling:

```typescript
// In your Lambda handler
import { GetUserRequestValidator, GetUserResponseValidator } from "./api/generated";

export const handler = async (event: APIGatewayProxyEvent) => {
  const requestValidator = new GetUserRequestValidator();

  try {
    const validatedRequest = requestValidator.validate({
      param: event.pathParameters,
      header: event.headers,
    });

    // Handle request with type safety
    const user = await userService.getUser(validatedRequest.param.userId);

    return {
      statusCode: 200,
      body: JSON.stringify(user),
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Invalid request", issues: error.issues }),
      };
    }
    throw error;
  }
};
```

## Advanced Features

### Custom Validators

Extend generated validators for custom validation logic:

```typescript
import { GetUserRequestValidator } from "./api/generated";

export class CustomGetUserRequestValidator extends GetUserRequestValidator {
  public validate(request: unknown): GetUserRequest {
    const validated = super.validate(request);

    // Custom validation logic
    if (validated.param.userId.startsWith("test_")) {
      throw new Error("Test users not allowed in production");
    }

    return validated;
  }
}
```

### Schema Composition

Generated schemas can be composed and extended:

```typescript
import { GetUserRequestSchema } from "./api/generated";

// Extend for internal usage
export const InternalGetUserRequestSchema = GetUserRequestSchema.extend({
  internal: z.object({
    requestId: z.string(),
    userId: z.string(),
  }),
});
```

## Plugin Architecture

This plugin extends the typeweaver plugin system:

```typescript
import { BasePlugin, type GeneratorContext } from "@rexeus/typeweaver-gen";

export default class TypesPlugin extends BasePlugin {
  public name = "types";

  public override generate(context: GeneratorContext): void {
    // Generates types and validators for all operations
    SharedResponseGenerator.generate(context);
    RequestGenerator.generate(context);
    RequestValidationGenerator.generate(context);
    ResponseGenerator.generate(context);
    ResponseValidationGenerator.generate(context);
  }
}
```

## Best Practices

### Organization

- Keep generated types in source control for review
- Regenerate types when API definitions change
- Use TypeScript strict mode for maximum safety

### Validation Strategy

```typescript
// Validate at boundaries
export class ApiController {
  async getUser(request: unknown) {
    // Validate input
    const validator = new GetUserRequestValidator();
    const validatedRequest = validator.validate(request);

    // Business logic with typed data
    const user = await this.userService.getUser(validatedRequest.param.userId);

    // Return typed response
    return {
      statusCode: 200,
      body: user,
    } as GetUserSuccessResponse;
  }
}
```

### Error Handling

```typescript
// Centralized error mapping
export function mapValidationError(error: ZodError): ValidationErrorResponse {
  return {
    statusCode: 400,
    body: {
      message: "Validation failed",
      issues: error.issues.map(issue => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    },
  };
}
```

## Troubleshooting

### Common Issues

**Type conflicts**: Ensure API definitions are consistent **Validation errors**: Check Zod schema
compatibility **Import issues**: Verify generated files are properly exported

### Debug Mode

Enable detailed generation logging:

```bash
DEBUG=typeweaver:types npx typeweaver generate --plugins types
```

## License

Apache 2.0 © Dennis Wentzien 2025
