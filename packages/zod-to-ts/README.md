# `@rexeus/typeweaver-zod-to-ts`

> Convert Zod 4 schemas into TypeScript AST nodes and printable type expressions, with explicit
> errors for schema families that TypeWeaver knows it cannot represent safely.

[![npm version](https://img.shields.io/npm/v/@rexeus/typeweaver-zod-to-ts.svg)](https://www.npmjs.com/package/@rexeus/typeweaver-zod-to-ts)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](../../LICENSE)

## Choose this package when

Use this standalone converter when code generation needs a TypeScript type representation of a Zod
schema.

TypeWeaver's generated request and response types use this conversion layer internally, but the
package can be used without a TypeWeaver API spec.

## Install

```bash
pnpm add @rexeus/typeweaver-zod-to-ts zod
```

The supported Zod peer range is `>=4.3.0 <5`.

## Convert and print

```ts
import { fromZod, print } from "@rexeus/typeweaver-zod-to-ts";
import { z } from "zod";

const UserSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
  age: z.number().int().optional(),
});

const typeNode = fromZod(UserSchema);
const source = print(typeNode);

console.log(source);
// { id: string; name: string; email: string; age?: number | undefined; }
```

<!-- docs-example: zod-to-ts -->

The converter, printer, and explicit unsupported-schema error are typechecked in the
[Zod-to-TypeScript fixture](../cli/examples/documentation/zod-to-ts.ts).

`fromZod()` returns a TypeScript AST node. Keep the node when composing a larger generated
declaration; call `print()` when you need source text.

## Supported schema families

The converter supports the TypeScript type shape of:

- primitives, literals, enums, null, undefined, unknown, any, void, never, and NaN;
- objects, optional properties, records, arrays, tuples, maps, and sets;
- unions and intersections;
- optional, nullable, default, non-optional, readonly, and catch wrappers;
- promises;
- supported pipe output schemas;
- special Zod 4 schemas such as file and success values where a TypeScript representation exists.

Validation checks such as string length or numeric ranges do not change the TypeScript type and are
therefore not represented in the emitted node. Runtime validation remains the responsibility of Zod.

## Known unsupported schemas fail explicitly

The converter never broadens an unrecognized schema to `any`. These known schema families currently
throw `UnsupportedZodTypeError`:

- `z.lazy()`;
- `z.templateLiteral()`;
- `z.custom()`;
- `z.transform()`.

```ts
import { fromZod, UnsupportedZodTypeError } from "@rexeus/typeweaver-zod-to-ts";
import { z } from "zod";

try {
  fromZod(z.string().transform(value => value.length));
} catch (error) {
  if (error instanceof UnsupportedZodTypeError) {
    console.error(error.code); // "UNSUPPORTED_ZOD_TYPE"
    console.error(error.schemaKind); // "transform"
    console.error(error.reason);
  }
}
```

The stable error code is `UNSUPPORTED_ZOD_TYPE`. The `schemaKind` identifies the unsupported family
and `reason` explains how to restructure the source.

A pipe is supported only when its output schema is supported. Intentional `z.unknown()` remains
valid and emits TypeScript's `unknown` type. A future or otherwise unrecognized Zod schema kind
currently falls back to TypeScript `unknown`, which keeps the generated type safe without pretending
that the converter preserved more information than it understood.

## Compose larger type expressions

`fromZod()` returns a TypeScript `TypeNode`, so generator code can combine it with other type nodes
before calling `print()`. The package intentionally exposes the type expression rather than choosing
a surrounding alias, interface, export modifier, or file layout for you.

## Boundaries

This converter does not:

- emit runtime validators;
- preserve validation checks that do not affect a TypeScript type;
- evaluate transforms;
- infer recursive types from `z.lazy()`;
- turn known unsupported schema families into a broader type silently;
- generate a complete TypeWeaver operation or file layout.

For generated operation types and validators, use TypeWeaver's automatic
[`types`](../types/README.md) projection.

## Related documentation

- [Migration guide](../../MIGRATION.md)
- [Generated types and validators](../types/README.md)
- [Zod to JSON Schema](../zod-to-json-schema/README.md)
- [Plugin SDK](../gen/README.md)

## License

Apache 2.0 © Dennis Wentzien 2026
