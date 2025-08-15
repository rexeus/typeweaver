# @rexeus/typeweaver-aws-cdk

AWS CDK constructs and deployment utilities for typeweaver APIs.

## Overview

This plugin generates AWS CDK constructs and HTTP API Gateway routers from your typeweaver API
definitions, making it easy to deploy type-safe APIs to AWS.

## Installation

```bash
npm install @rexeus/typeweaver-aws-cdk
```

**Peer Dependencies:**

```bash
npm install @rexeus/typeweaver-core @rexeus/typeweaver-gen
```

## Usage

### CLI

```bash
npx typeweaver generate --input ./api/definitions --output ./api/generated --plugins aws-cdk
```

### Configuration File

```javascript
// typeweaver.config.js
export default {
  input: "./api/definitions",
  output: "./api/generated",
  plugins: ["aws-cdk"],
};
```

## Generated Output

This plugin generates HTTP API Gateway routers for each entity in your API definitions.

### Example Generated Router

For an API definition with a `users` entity, the plugin generates:

```typescript
// UsersHttpApiRouter.ts
import { HttpMethod } from "@rexeus/typeweaver-core";

export const UsersHttpApiRouter = {
  "/users": [HttpMethod.POST],
  "/users/{userId}": [HttpMethod.GET, HttpMethod.PUT, HttpMethod.DELETE],
};
```

### Router Structure

The generated routers provide:

- **Route Definitions** - Express-style paths converted to API Gateway format
- **HTTP Methods** - Supported methods for each route
- **Parameter Mapping** - Path parameters (`:param` → `{param}`)

### Path Conversion

The plugin automatically converts Express-style paths to API Gateway format:

- `/users/:userId` → `/users/{userId}`
- `/users/:userId/posts/:postId` → `/users/{userId}/posts/{postId}`

## AWS CDK Integration

Use the generated routers in your CDK stacks:

```typescript
import { HttpApi, HttpMethod } from "@aws-cdk/aws-apigatewayv2-alpha";
import { UsersHttpApiRouter, PostsHttpApiRouter } from "./api/generated";

export class ApiStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const api = new HttpApi(this, "TypeweaverApi");

    // Add routes from generated routers
    Object.entries(UsersHttpApiRouter).forEach(([path, methods]) => {
      methods.forEach(method => {
        api.addRoutes({
          path,
          methods: [method],
          integration: new HttpLambdaIntegration("UsersIntegration", usersHandler),
        });
      });
    });

    Object.entries(PostsHttpApiRouter).forEach(([path, methods]) => {
      methods.forEach(method => {
        api.addRoutes({
          path,
          methods: [method],
          integration: new HttpLambdaIntegration("PostsIntegration", postsHandler),
        });
      });
    });
  }
}
```

## Complete AWS Deployment Example

### 1. Define Your API

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
      userId: z.string(),
    }),
  },
  responses: [
    {
      statusCode: HttpStatusCode.OK,
      body: z.object({
        id: z.string(),
        name: z.string(),
        email: z.email(),
      }),
    },
  ],
});
```

### 2. Generate Code

```bash
npx typeweaver generate --input ./api/definitions --output ./api/generated --plugins aws-cdk,types,clients
```

### 3. Create CDK Stack

```typescript
// lib/api-stack.ts
import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { HttpApi } from "@aws-cdk/aws-apigatewayv2-alpha";
import { HttpLambdaIntegration } from "@aws-cdk/aws-apigatewayv2-integrations-alpha";
import { UsersHttpApiRouter } from "../api/generated/users/UsersHttpApiRouter";

export class ApiStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const api = new HttpApi(this, "TypeweaverApi");

    // Create Lambda handler (your implementation)
    const usersHandler = new Function(this, "UsersHandler", {
      // Lambda configuration
    });

    // Add routes using generated router
    Object.entries(UsersHttpApiRouter).forEach(([path, methods]) => {
      methods.forEach(method => {
        api.addRoutes({
          path,
          methods: [method],
          integration: new HttpLambdaIntegration("UsersIntegration", usersHandler),
        });
      });
    });
  }
}
```

### 4. Deploy

```bash
cdk deploy
```

## Features

### Route Organization

- **Entity-based routing** - Each entity gets its own router file
- **Method grouping** - Routes grouped by HTTP method support
- **Parameter extraction** - Path parameters automatically identified

### Type Safety

- **Generated types** - Work seamlessly with other typeweaver plugins
- **CDK integration** - Type-safe AWS CDK constructs
- **Validation** - Runtime validation via typeweaver Core

### Development Workflow

- **Hot reload** - Regenerate routes when API definitions change
- **Version control** - Generated files can be committed for review
- **Testing** - Generated routes can be unit tested

## Plugin Architecture

This plugin extends the typeweaver plugin system:

```typescript
import { BasePlugin, type GeneratorContext } from "@rexeus/typeweaver-gen";

export default class AwsCdkPlugin extends BasePlugin {
  public name = "aws-cdk";

  public override generate(context: GeneratorContext): void {
    // Generates HTTP API routers for each entity
  }
}
```

## Best Practices

### CDK Integration

- Use the generated routers as single source of truth for API routes
- Combine with other typeweaver plugins for complete type safety
- Version generated files in source control

### Deployment

- Generate code before CDK synthesis
- Use CDK context for environment-specific configuration
- Implement proper error handling in Lambda functions

### Monitoring

- Add CloudWatch metrics for generated routes
- Implement distributed tracing
- Monitor API Gateway throttling and errors

## Troubleshooting

### Common Issues

**Route conflicts**: Ensure API definitions don't have conflicting paths **Method mismatches**:
Verify HTTP methods in definitions match usage **Parameter mapping**: Check path parameter names are
consistent

### Debug Mode

Enable verbose logging during generation:

```bash
DEBUG=typeweaver:* npx typeweaver generate --plugins aws-cdk
```

## License

Apache 2.0 © Dennis Wentzien 2025
