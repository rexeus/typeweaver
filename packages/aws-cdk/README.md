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

<!-- docs-example: aws-cdk-routes -->

TypeWeaver authoring paths such as `/todos/:todoId` become API Gateway paths such as
`/todos/{todoId}`. Operations that share one path are grouped into one route entry with several
methods.

## Register the routes in a CDK stack

`aws-cdk-lib` and `constructs` are application dependencies, not TypeWeaver runtime dependencies.
This repository does not install or typecheck them, so it publishes no executable stack example. The
supported integration point is the generated route metadata shown above.

An application connects the two in ordinary infrastructure code:

1. Install `aws-cdk-lib` and `constructs` in the package that owns the stack.
2. Import each generated `*HttpApiRoutes` class from the generation output.
3. Map its framework-neutral `HttpMethod` values to the AWS CDK HTTP API method enum at the
   integration boundary.
4. Add the routes to an `HttpApi`, selecting the integration, authorizer, and per-route
   infrastructure the application uses.

One integration per resource is only an example. You can select integrations per path or method,
combine generated resources, add authorizers, or attach route-specific infrastructure in ordinary
CDK code. The generated route metadata this wiring consumes is typechecked by the repository
documentation fixtures.

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
