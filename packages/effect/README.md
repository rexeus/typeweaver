# @rexeus/typeweaver-effect

Add Effect-returning handlers to TypeWeaver's existing Fetch-native server. This package is an
optional adapter and generator plugin: it does not introduce Effect Schema, a second router, or a
native `HttpApi` backend, and ordinary server users do not install it.

## Installation

Install the server and Effect plugins for generation, plus the supported Effect 3 peer:

```bash
npm install -D \
  @rexeus/typeweaver \
  @rexeus/typeweaver-server \
  @rexeus/typeweaver-effect
npm install effect@^3.22.0
```

The package supports Effect `>=3.22.0 <4`. TypeWeaver itself develops against the pinned 3.22.0
reference.

## Generate

Select the existing server and the Effect adapter:

```bash
npx typeweaver generate \
  --input ./api/spec/index.ts \
  --output ./api/generated \
  --plugins server,effect
```

For every resource, generation adds `Effect<Resource>ApiHandler.ts`. It contains:

- request- and response-specific Effect handler types
- typed error mappers for each operation
- an `adapt<Resource>EffectHandlers` function returning the existing `Server<Resource>ApiHandler`

The generated adapter contains no runtime construction and no `Effect.runPromise`. It delegates to
one runtime supplied by the application.

## Runtime ownership

Create one runtime beside the application, adapt every handler record with it, and dispose it from
the application's graceful-shutdown hook:

```ts
const runtime = createEffectHandlerRuntime(applicationLayer);

const accountRouter = new AccountRouter({
  requestHandlers: adaptAccountEffectHandlers(runtime, handlers, errorMappers),
});

const app = new TypeweaverApp().route(accountRouter);

export const shutdown = async (): Promise<void> => {
  await runtime.dispose();
};
```

`createEffectHandlerRuntime` accepts a `Layer<R, never, never>`. This keeps Layer construction
failures outside the operation's typed business-error channel. The managed Layer is acquired once,
shared by requests, and released exactly once even when `dispose` is called more than once. Await
`shutdown` from the hosting runtime's graceful-shutdown hook.

<!-- docs-example: effect-handler -->

The complete service, typed-error, adapter, and shutdown setup is typechecked in the
[Effect handler fixture](../cli/examples/documentation/effect-handler.ts).

## Failure, cancellation, and observability

- A handler returns `Effect<Response, Error, Requirements>`.
- Each operation maps its typed `Error` to its own generated response union.
- Defects and interruptions never enter that mapper. They cross the existing server unknown-error
  boundary as sanitized `EffectHandlerDefectError` or `EffectHandlerInterruptedError` values.
- The runtime passes `ServerContext.signal` to Effect 3.22's managed runtime. Aborting the incoming
  Fetch request therefore interrupts the handler fiber.
- Each handler runs in `typeweaver.handler.<operationId>` with server-span kind. The operation ID,
  HTTP method, and route pattern are attached as span attributes and structured log annotations.

The server response for a defect remains the existing sanitized 500 response. Applications can use
the server's `onError` callback for internal reporting without exposing defect details to clients.

## Plain Promise handlers

The generated server contract remains Promise-native. The Effect plugin only generates adapter types
and functions, and `@rexeus/typeweaver-server` has no Effect dependency. Promise handlers and mixed
projects continue to use the ordinary server package unchanged.

## License

Apache 2.0 © Dennis Wentzien 2026
