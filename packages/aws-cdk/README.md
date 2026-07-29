# `@rexeus/typeweaver-aws-cdk`

> Generate AWS CDK route declarations for API Gateway HTTP APIs while keeping integrations,
> authorization, deployment, and stack composition in application-owned infrastructure code.

[![npm version](https://img.shields.io/npm/v/@rexeus/typeweaver-aws-cdk.svg)](https://www.npmjs.com/package/@rexeus/typeweaver-aws-cdk)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](../../LICENSE)

## Choose this projection when

Use `aws-cdk` when an AWS CDK stack should consume the same operation paths and methods as the rest
of your TypeWeaver-generated surfaces.

It is intentionally a narrow infrastructure projection: TypeWeaver describes the routes; your stack
decides what serves them.

## Generate route helpers

The first-party plugin ships with the TypeWeaver CLI:

```bash
pnpm add -D @rexeus/typeweaver
pnpm add @rexeus/typeweaver-core zod
```

Select it in configuration:

```js
// typeweaver.config.mjs
export default {
  input: "./api/spec/index.ts",
  output: "./api/generated",
  plugins: ["aws-cdk"],
};
```

```bash
pnpm typeweaver validate
pnpm typeweaver generate
```

The `types` projection is included automatically.

## Generated surface

For a `todo` resource, the plugin emits:

```text
api/generated/
├── lib/aws-cdk/
│   └── AwsHttpApiGatewayRoutes.ts
└── todo/
    └── TodoHttpApiRoutes.ts
```

`TodoHttpApiRoutes#getRoutes()` returns route metadata:

```ts
import { TodoHttpApiRoutes } from "./api/generated/index.js";

const routes = new TodoHttpApiRoutes().getRoutes();
// Array<{ path: string; methods: HttpMethod[] }>
```

TypeWeaver authoring paths such as `/todos/:todoId` become API Gateway paths such as
`/todos/{todoId}`. Operations that share one path are grouped into one route entry with several
methods.

## Register the routes in a CDK stack

Install the AWS CDK libraries your application uses:

```bash
pnpm add aws-cdk-lib constructs
```

Then combine generated route metadata with an application-owned integration:

```ts
import { HttpMethod as ContractHttpMethod } from "@rexeus/typeweaver-core";
import { Construct } from "constructs";
import { HttpApi, HttpMethod as CdkHttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { TodoHttpApiRoutes } from "./api/generated/index.js";

const cdkHttpMethodByContractMethod = {
  [ContractHttpMethod.GET]: CdkHttpMethod.GET,
  [ContractHttpMethod.POST]: CdkHttpMethod.POST,
  [ContractHttpMethod.PUT]: CdkHttpMethod.PUT,
  [ContractHttpMethod.DELETE]: CdkHttpMethod.DELETE,
  [ContractHttpMethod.PATCH]: CdkHttpMethod.PATCH,
  [ContractHttpMethod.OPTIONS]: CdkHttpMethod.OPTIONS,
  [ContractHttpMethod.HEAD]: CdkHttpMethod.HEAD,
} satisfies Record<ContractHttpMethod, CdkHttpMethod>;

const toCdkHttpMethod = (method: ContractHttpMethod): CdkHttpMethod =>
  cdkHttpMethodByContractMethod[method];

type TodoApiProps = {
  readonly httpApi: HttpApi;
};

export class TodoApi extends Construct {
  public constructor(scope: Construct, id: string, props: TodoApiProps) {
    super(scope, id);

    const handler = new NodejsFunction(this, "Handler", {
      entry: "src/todo-lambda.ts",
    });

    const integration = new HttpLambdaIntegration("TodoIntegration", handler);

    for (const route of new TodoHttpApiRoutes().getRoutes()) {
      props.httpApi.addRoutes({
        path: route.path,
        methods: route.methods.map(toCdkHttpMethod),
        integration,
      });
    }
  }
}
```

The generated metadata deliberately uses TypeWeaver's framework-neutral `HttpMethod` enum, so the
stack maps it to the AWS CDK enum at the integration boundary. One integration per resource is only
an example. You can select integrations per path or method, combine generated resources, add
authorizers, or attach route-specific infrastructure in ordinary CDK code.

## What stays synchronized

Generation keeps these pieces aligned with the contract:

- route paths;
- path-parameter syntax conversion;
- HTTP methods;
- resource grouping;
- generated method summaries in source documentation.

## What remains application-owned

The generated route list does not decide:

- Lambda, ECS, HTTP proxy, or other integrations;
- authorizers and authorization policy;
- stages, domains, throttling, logging, or observability;
- request/response mapping;
- deployment topology;
- IAM permissions;
- business logic.

This boundary keeps the contract reusable without turning TypeWeaver into a stack framework.

## Current scope

The projection targets AWS API Gateway **HTTP API (V2)** route helpers. It does not currently
generate REST API (V1) constructs or complete CDK stacks.

## Related documentation

- [Migration guide](../../MIGRATION.md)
- [Getting started](../../docs/getting-started.md)
- [Contract authoring](../core/README.md)
- [Fetch-native server](../server/README.md)
- [CLI reference](../cli/README.md)

## License

Apache 2.0 © Dennis Wentzien 2026
