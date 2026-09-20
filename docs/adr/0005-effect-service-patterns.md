# ADR 0005: Effect 4 service compatibility

## Status

Accepted; supersedes the pre-RC service-builder guidance formerly recorded here.

## Context

Effect 4.0.0-rc.116 uses `Context.Service` for service identifiers. The RC no longer synthesizes the
default layer, accessors, or a public construction helper from a service declaration. TypeWeaver
also has a compatibility requirement: consumers must be able to construct service-shaped test
doubles without depending on private layer wiring.

## Decision

Public services use the class form `Context.Service<Self, Shape>()("id")` and explicitly define the
parts of their public contract that callers use:

- `static readonly make = (service: Shape) => service` preserves the identity constructor that
  previous `Effect.Service` declarations exposed;
- `Default` and, where needed, `DefaultWithoutDependencies` are explicit layers;
- static accessors delegate through `Service.use` and remain available where they were public.

The service's `make` effect is defined separately when construction needs dependencies. Layers
provide those dependencies at the composition boundary rather than hiding a runtime inside a public
accessor. `Layer.effect`, `Layer.succeed`, `Layer.provide`, and `Layer.merge` are the RC.116 forms.

The public compatibility surface is covered by package-root runtime and type tests. Generated plain
client, server, and Hono output do not inherit this Effect requirement; only the authoring and
native plugin packages expose these services.

## Consequences

The declaration is slightly more verbose than the retired builder, but the identity constructor and
layer graph are visible in source and stable for third-party test doubles. A new public service must
add its `make`, default layer, accessors, and package-root contract test together.

## References

- [Effect 4 baseline](./0008-effect-4-baseline.md)
- `packages/gen/src/services/`
- `packages/cli/src/services/`
