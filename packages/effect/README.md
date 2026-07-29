# `@rexeus/typeweaver-effect`

> Implement generated Fetch-native server handlers with Effect while keeping TypeWeaver's existing
> router, request contract, response union, and error boundary.

[![npm version](https://img.shields.io/npm/v/@rexeus/typeweaver-effect.svg)](https://www.npmjs.com/package/@rexeus/typeweaver-effect)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](../../LICENSE)

## Choose this projection when

Use `effect` when your application services and handlers already use Effect and should expose typed
failures, Layers, interruption, spans, and structured log annotations through the generated server
contract.

Ordinary Promise-based server users do not need this package.

This is an adapter, not a second server stack. It does not introduce Effect Schema, an Effect
router, or a native Effect `HttpApi` backend.

## Install and generate

```bash
pnpm add -D @rexeus/typeweaver
pnpm add \
  @rexeus/typeweaver-core \
  @rexeus/typeweaver-effect \
  effect \
  zod

pnpm typeweaver generate \
  --input ./api/spec/index.ts \
  --output ./api/generated \
  --plugins server,effect
```

The package supports Effect `>=3.22.0 <4`.

The direct runtime dependency on `@rexeus/typeweaver-effect` is intentional: generated adapters
reference its public types, and the application owns `createEffectHandlerRuntime`.

## Generated surface

For every resource, generation adds `Effect<Resource>ApiHandler.ts` next to the Fetch-native router:

```text
api/generated/todo/
├── TodoRouter.ts
└── EffectTodoApiHandler.ts
```

It exports:

- `EffectTodoApiHandler<TError, TRequirements, TState>`;
- `EffectTodoErrorMappers<TError, TState>`;
- `adaptTodoEffectHandlers(...)`.

The adapter returns the ordinary `ServerTodoApiHandler` required by `TodoRouter`.

## Own one runtime at the application boundary

```ts
// effect-runtime.ts
import { createEffectHandlerRuntime } from "@rexeus/typeweaver-effect";
import { Context, Effect, Layer } from "effect";

type Todo = {
  readonly id: string;
  readonly title: string;
};

export class TodoRepository extends Context.Tag("Todo/Repository")<
  TodoRepository,
  {
    readonly find: (todoId: string) => Effect.Effect<Todo | undefined>;
  }
>() {}

const TodoRepositoryLive = Layer.succeed(TodoRepository, {
  find: todoId =>
    Effect.succeed(todoId === "todo-1" ? { id: todoId, title: "Ship the contract" } : undefined),
});

export const effectRuntime = createEffectHandlerRuntime(TodoRepositoryLive);
```

A managed Layer is acquired once, shared across requests, and released exactly once. `dispose()` is
idempotent.

Keep runtime creation outside generated adapters and request handlers. Do not create one managed
runtime per request.

## Implement Effect handlers

```ts
import { Data, Effect } from "effect";
import { createGetTodoSuccessResponse, type EffectTodoApiHandler } from "./api/generated/index.js";
import { TodoRepository } from "./effect-runtime.js";

export class TodoNotFound extends Data.TaggedError("TodoNotFound")<{
  readonly todoId: string;
}> {
  get message(): string {
    return `Todo ${this.todoId} was not found`;
  }
}

export const todoHandlers = {
  handleGetTodoRequest: request =>
    Effect.gen(function* () {
      const repository = yield* TodoRepository;
      const todo = yield* repository.find(request.param.todoId);

      if (todo === undefined) {
        return yield* Effect.fail(new TodoNotFound({ todoId: request.param.todoId }));
      }

      return createGetTodoSuccessResponse({ body: todo });
    }),
} satisfies EffectTodoApiHandler<TodoNotFound, TodoRepository>;
```

Map the typed business-error channel into the operation's declared response union:

```ts
import { createTodoNotFoundResponse, type EffectTodoErrorMappers } from "./api/generated/index.js";

export const todoErrorMappers = {
  handleGetTodoRequest: error =>
    createTodoNotFoundResponse({
      body: {
        message: "Todo not found",
        todoId: error.todoId,
      },
    }),
} satisfies EffectTodoErrorMappers<TodoNotFound>;
```

<!-- docs-example: effect-handler -->

The complete Layer, tagged-error, adapter, mapper, and shutdown path is typechecked in the
[Effect handler fixture](../cli/examples/documentation/effect-handler.ts).

Each operation has its own mapper, so TypeScript checks that a typed failure becomes a response that
operation actually declares.

## Adapt and mount

```ts
import { adaptTodoEffectHandlers, TodoRouter, TypeweaverApp } from "./api/generated/index.js";
import { effectRuntime } from "./effect-runtime.js";
import { todoErrorMappers, todoHandlers } from "./todo-handlers.js";

const router = new TodoRouter({
  requestHandlers: adaptTodoEffectHandlers(effectRuntime, todoHandlers, todoErrorMappers),
});

export const app = new TypeweaverApp().route(router);

export const shutdown = async (): Promise<void> => {
  await effectRuntime.dispose();
};
```

Call `shutdown` from the hosting runtime's graceful-shutdown hook.

## Failure semantics

The adapter preserves the distinction between business failures and runtime failures:

- typed Effect failures go to the generated operation mapper;
- defects become sanitized `EffectHandlerDefectError` values at the server's unknown-error boundary;
- interruption becomes `EffectHandlerInterruptedError`;
- defects and interruption never enter the typed business-error mapper.

The Fetch server's default unknown-error handling returns a sanitized 500. Use
`TypeweaverApp({ onError })` or a custom server error handler for internal reporting.

## Cancellation and observability

The incoming `ServerContext.signal` is passed to the managed Effect runtime. Aborting the Fetch
request interrupts the handler fiber.

Each operation runs in a span named:

```text
typeweaver.handler.<operationId>
```

The operation ID, HTTP method, and route pattern are attached as span attributes and structured log
annotations.

## Explicit HEAD operations

Generated Effect handler records omit HEAD operations. The Fetch-native server owns its existing
automatic GET-to-HEAD fallback behavior.

## Boundaries

This package does not:

- replace the Fetch-native TypeWeaver router;
- generate Effect Schema values;
- expose a native Effect `HttpApi` backend;
- move Layer ownership into generated code;
- turn defects into typed business failures.

## Related documentation

- [Migration guide](../../MIGRATION.md)
- [Fetch-native server](../server/README.md)
- [Getting started](../../docs/getting-started.md)
- [Project vision and non-goals](../../VISION.md)

## License

Apache 2.0 © Dennis Wentzien 2026
