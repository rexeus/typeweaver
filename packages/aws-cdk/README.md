# 🧵✨ @rexeus/typeweaver-aws-cdk

[![npm version](https://img.shields.io/npm/v/@rexeus/typeweaver-aws-cdk.svg)](https://www.npmjs.com/package/@rexeus/typeweaver-aws-cdk)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

Typeweaver is a type-safe HTTP API framework built for API-first development with a focus on
developer experience. Use typeweaver to specify your HTTP APIs in TypeScript and Zod, and generate
clients, validators, routers, and more ✨

## 📝 AWS CDK Plugin

This plugin generates utils for the AWS CDK from your typeweaver API definitions, making it easy to
deploy type-safe APIs to AWS. Currently only the AWS API Gateway HTTP API (V2) is supported.

---

## 📥 Installation

```bash
# Install the CLI and the plugin as a dev dependency
npm install -D @rexeus/typeweaver @rexeus/typeweaver-aws-cdk

# Install the runtime as a dependency
npm install @rexeus/typeweaver-core
```

## 💡 CLI Usage

```bash
npx typeweaver generate --input ./api/definitions --output ./api/generated --plugins aws-cdk
```

More details on how to use the [CLI](../cli/README.md#️-cli).

## 📂 Generated Output

For each resource, one file is generated: `<ResourceName>HttpApiRoutes.ts`.

This file contains a generated class `<ResourceName>HttpApiRoutes` that includes all routes for its
defined operations, e.g. `TodoHttpApiRoutes`.

```typescript
import { Construct } from "constructs";
import { HttpApi } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { TodoHttpApiRoutes } from "path/to/generated/output";

type TodoApiProps = {
  // Provide an HttpApi instance, where the routes for the resource should be added
  readonly httpApi: HttpApi;
  // ...
};

export class TodoApi extends Construct {
  public constructor(
    scope: Construct,
    id: string,
    private readonly props: TodoApiProps
  ) {
    // A Lambda handler for the resource API
    const apiHandler = new NodejsFunction(this, "Handler", {
      // ...
    });
    const integration = new HttpLambdaIntegration("Integration", apiHandler);

    // Get all routes
    const routes = new TodoHttpApiRoutes().getRoutes();
    for (const endpoint of routes) {
      // Register the routes with the HTTP API
      this.props.httpApi.addRoutes({
        integration,
        path: endpoint.path,
        methods: endpoint.methods,
      });
    }
  }
}
```

## 📄 License

Apache 2.0 © Dennis Wentzien 2025
