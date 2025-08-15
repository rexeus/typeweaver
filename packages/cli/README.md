# @rexeus/typeweaver

CLI tool for generating type-safe API code from TypeWeaver definitions.

## Installation

```bash
npm install -D @rexeus/typeweaver
```

## Usage

Generate TypeScript code from your API definitions:

```bash
npx typeweaver generate --input ./api/definitions --output ./api/generated --plugins clients,aws-cdk
```

### Options

- `--input, -i <path>`: Input directory containing API definitions (required)
- `--output, -o <path>`: Output directory for generated code (required)
- `--config, -c <path>`: Configuration file path (optional)
- `--plugins, -p <plugins>`: Comma-separated list of plugins to use (e.g., "clients,aws-cdk")
- `--prettier / --no-prettier`: Enable/disable code formatting with Prettier (default: true)
- `--clean / --no-clean`: Enable/disable output directory cleaning (default: true)

### What Gets Generated

From your API definitions, TypeWeaver generates:

1. **Request Types & Commands** - Type-safe request interfaces and command classes
2. **Response Types** - Typed response interfaces for all status codes
3. **Validators** - Runtime validators for requests and responses using Zod
4. **API Clients** - Typed HTTP clients with automatic response validation
5. **Router Implementations** - HTTP API Gateway routers (with aws-cdk plugin)
6. **Shared Error Types** - Reusable error response types

### Project Structure

Your API definitions should follow this structure:

```
api/definitions/
├── users/                        # Entity directory
│   ├── GetUserDefinition.ts      # Operation definition
│   ├── CreateUserDefinition.ts
│   └── userSchema.ts             # Schemas for the entity
├── posts/
│   ├── GetPostDefinition.ts
│   └── CreatePostDefinition.ts
└── shared/                       # Shared responses
    ├── NotFoundErrorDefinition.ts
    ├── ValidationErrorDefinition.ts
    └── sharedResponses.ts
```

**Important**: All definition files and their dependencies must be self-contained within the input directory. Generated code creates an immutable snapshot of your definitions, so any external imports (relative imports outside the input directory) will not work. NPM package imports continue to work normally.

### Example Definition

```typescript
// api/definitions/users/GetUserDefinition.ts
import { HttpOperationDefinition, HttpMethod, HttpStatusCode } from "@rexeus/typeweaver-core";
import { z } from "zod/v4";

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
      body: z.object({
        id: z.uuid(),
        name: z.string(),
        email: z.email(),
      }),
    },
  ],
});
```

## Plugin System

TypeWeaver supports a plugin-based architecture for extensible code generation. Available plugins:

- **types** (default): TypeScript types and Zod validators
- **clients**: HTTP API client generation
- **aws-cdk**: AWS CDK constructs and HTTP API Gateway routers

### Using Plugins

Via command line:

```bash
npx typeweaver generate --input ./api/definitions --output ./api/generated --plugins clients,aws-cdk
```

### Configuration File

Create a `typeweaver.config.js` file for more complex configurations:

```javascript
export default {
  input: "./api/definitions",
  output: "./api/generated",
  plugins: ["clients", "aws-cdk"],
  prettier: true,
  clean: true,
};
```

Then run:

```bash
npx typeweaver generate --config ./typeweaver.config.js
```

## Generated Output

With the **clients** plugin, you'll get type-safe API clients:

```typescript
import { UsersClient } from "./api/generated";

const client = new UsersClient({ baseURL: "https://api.example.com" });
const result = await client.send(new GetUserRequestCommand({ param: { userId: "123" } }));
```

With the **aws-cdk** plugin, you'll get HTTP API Gateway routers:

```typescript
import { UsersHttpApiRouter } from "./api/generated";

const router = new UsersHttpApiRouter();
// Use in your AWS CDK stack
```

## License

Apache 2.0 © Dennis Wentzien 2025
