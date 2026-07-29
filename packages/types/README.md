# `@rexeus/typeweaver-types`

> Generate the request types, response unions, response factories, and Zod validators that every
> other TypeWeaver surface builds on.

[![npm version](https://img.shields.io/npm/v/@rexeus/typeweaver-types.svg)](https://www.npmjs.com/package/@rexeus/typeweaver-types)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](../../LICENSE)

## You usually do not select this plugin

The `types` projection is always loaded by TypeWeaver. It is the common foundation for clients,
routers, commands, and adapters.

Install the product and runtime dependencies:

```bash
pnpm add -D @rexeus/typeweaver
pnpm add @rexeus/typeweaver-core zod
```

Then select only the additional projections you need:

```bash
pnpm typeweaver generate \
  --input ./api/spec/index.ts \
  --output ./api/generated \
  --plugins clients
```

Types and validators are generated automatically alongside the client.

## Generated surface

For an operation with `operationId: "createTodo"`, the plugin emits:

```text
CreateTodoRequest.ts
CreateTodoRequestValidator.ts
CreateTodoResponse.ts
CreateTodoResponseValidator.ts
```

### Request file

The request file contains operation-specific types for every declared request part and one complete
request interface, for example:

- `ICreateTodoRequestHeader`;
- `ICreateTodoRequestParam`;
- `ICreateTodoRequestQuery`;
- `ICreateTodoRequestBody`;
- `ICreateTodoRequest`.

Only declared request parts appear with a precise type.

### Response file

The response file contains:

- one typed interface per declared response;
- one factory per response;
- the complete operation response union;
- a success-only union where applicable.

```ts
import { createCreateTodoSuccessResponse, type CreateTodoResponse } from "./api/generated/index.js";

const response: CreateTodoResponse = createCreateTodoSuccessResponse({
  body: {
    id: crypto.randomUUID(),
    title: "Write documentation",
    completed: false,
  },
});
```

Factories set stable response discriminators and status codes from the contract. Application code
supplies only the declared headers and body.

## Request validation

```ts
import { HttpMethod, type IHttpRequest } from "@rexeus/typeweaver-core";
import { GetTodoRequestValidator } from "./api/generated/index.js";

const validator = new GetTodoRequestValidator();

const input: IHttpRequest = {
  method: HttpMethod.GET,
  path: "/todos/846a8c8d-28dc-4b66-ae6c-8d1c551430b2",
  param: {
    todoId: "846a8c8d-28dc-4b66-ae6c-8d1c551430b2",
  },
};

const result = validator.safeValidate(input);

if (result.isValid) {
  result.data.param.todoId; // typed and validated
} else {
  console.error(result.error);
}
```

Use `validate()` when a throwing boundary is more convenient. It returns the validated request or
throws `RequestValidationError` with structured issues.

The validator:

- validates header, path-parameter (`param`), query, and body schemas;
- coerces supported query and header string values to their schema representation;
- groups issues by request part;
- returns the parsed Zod value;
- preserves the request method and concrete path unchanged;
- follows the schema's object behavior, including removal of unknown object keys for ordinary Zod
  objects.

## Response validation

```ts
import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { GetTodoResponseValidator } from "./api/generated/index.js";

const result = new GetTodoResponseValidator().safeValidate({
  statusCode: HttpStatusCode.OK,
  body: {
    id: "846a8c8d-28dc-4b66-ae6c-8d1c551430b2",
    title: "Write documentation",
    completed: false,
    internalOnly: "removed by the declared object schema",
  },
});

if (result.isValid) {
  console.log(result.data.type); // "GetTodoSuccess"
}
```

A response must match a declared status/schema combination. Valid responses are returned in their
parsed form.

A response that matches no declared contract is not silently widened. Callers receive the structured
response-validation boundary used by the generated client and server integrations.

Unknown object keys may be removed when the declared Zod object schema parses the response. That is
normal schema parsing; it is different from accepting an unrecognized response.

## Why this projection is always present

Every higher-level projection needs the same answers:

- What can enter this operation?
- What can leave it?
- How is external input validated?
- How is a response discriminated?

Generating those answers once prevents each adapter from reimplementing the contract independently.

## Boundaries

This plugin generates types and validators. It does not:

- send HTTP requests;
- register routes;
- implement authentication;
- choose a server framework;
- turn every Zod runtime behavior into an exactly equivalent TypeScript or standards representation.

Projection limits are reported by the relevant converter or target plugin.

## Related documentation

- [Migration guide](../../MIGRATION.md)
- [Getting started](../../docs/getting-started.md)
- [Contract authoring](../core/README.md)
- [Fetch clients](../clients/README.md)
- [Fetch-native server](../server/README.md)
- [Hono integration](../hono/README.md)

## License

Apache 2.0 © Dennis Wentzien 2026
