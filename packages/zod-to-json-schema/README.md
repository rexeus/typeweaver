# `@rexeus/typeweaver-zod-to-json-schema`

> Convert Zod 4 schemas into embeddable JSON Schema Draft 2020-12 objects while returning
> deterministic warnings for runtime behavior the target cannot express.

[![npm version](https://img.shields.io/npm/v/@rexeus/typeweaver-zod-to-json-schema.svg)](https://www.npmjs.com/package/@rexeus/typeweaver-zod-to-json-schema)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](../../LICENSE)

## Choose this package when

Use this standalone converter when you need a JSON Schema representation of a Zod 4 schema and must
know where the projection became broader or less precise.

TypeWeaver's OpenAPI projection uses the same conversion layer, but the package does not require a
TypeWeaver API spec.

## Install

```bash
pnpm add @rexeus/typeweaver-zod-to-json-schema zod
```

The supported Zod peer range is `>=4.3.0 <5`.

## Convert a schema

```ts
import { fromZod } from "@rexeus/typeweaver-zod-to-json-schema";
import { z } from "zod";

const result = fromZod(
  z.object({
    id: z.uuid(),
    name: z.string().optional(),
  })
);

console.log(result.schema);
// {
//   type: "object",
//   properties: {
//     id: { type: "string", format: "uuid" },
//     name: { type: "string" }
//   },
//   required: ["id"],
//   additionalProperties: false
// }

console.log(result.warnings); // []
```

`fromZod()` always returns both parts:

```ts
type ZodToJsonSchemaResult = {
  readonly schema: JsonSchema;
  readonly warnings: readonly ZodToJsonSchemaWarning[];
};
```

## Representational loss is explicit

Zod can describe runtime behavior that JSON Schema cannot reproduce exactly, including transforms,
custom refinements, dates, maps, sets, and unsupported checks.

```ts
const { schema, warnings } = fromZod(z.string().transform(value => value.length));

console.log(schema); // {}
console.log(warnings[0]?.code); // "unsupported-schema"
```

Warning codes are:

| Code                 | Meaning                                                    |
| -------------------- | ---------------------------------------------------------- |
| `unsupported-schema` | the schema kind has no faithful JSON Schema representation |
| `unsupported-check`  | a validation check cannot be preserved exactly             |
| `conversion-error`   | Zod's conversion failed                                    |

When conversion throws, `fromZod()` catches the failure, returns a broad `{}` schema, and appends a
`conversion-error` warning. Representability problems therefore remain inspectable data rather than
an unstructured log or an uncaught exception.

## Warning paths

Each warning includes:

```ts
type ZodToJsonSchemaWarning = {
  readonly code: "unsupported-schema" | "unsupported-check" | "conversion-error";
  readonly schemaType: string;
  readonly path: string;
  readonly message: string;
};
```

`path` is a JSON Pointer:

- the root is `""`;
- object properties use paths such as `/properties/name`;
- record keys and values use `/propertyNames` and `/additionalProperties`;
- `~` and `/` are escaped according to JSON Pointer rules.

Source concepts without a direct output location use stable TypeWeaver extension segments near the
affected schema, such as:

- `/x-typeweaver/mapKey`;
- `/x-typeweaver/mapValue`;
- `/x-typeweaver/pipeIn`;
- `/x-typeweaver/pipeOut`.

`schemaType` is best-effort diagnostic context from Zod internals. Do not use it as a stable machine
contract; use `code` and `path` instead.

## Output normalization

The converter:

- targets JSON Schema Draft 2020-12;
- removes the root `$schema` field so the result can be embedded in a larger document;
- normalizes tuple bounds for downstream compatibility;
- preserves a deterministic warning order.

## Treat warnings according to your use case

A broad schema may be acceptable for documentation but unacceptable for policy enforcement. The
caller owns that decision:

```ts
const result = fromZod(schema);

if (result.warnings.length > 0) {
  throw new Error(
    result.warnings
      .map(warning => `${warning.code} at ${warning.path}: ${warning.message}`)
      .join("\n")
  );
}
```

## Boundaries

This package does not:

- recreate Zod runtime transforms in JSON Schema;
- guarantee lossless round-tripping;
- validate data against the emitted schema;
- hide unsupported constructs;
- attach an OpenAPI document around the result.

For a complete API projection, use [`@rexeus/typeweaver-openapi`](../openapi/README.md).

## Related documentation

- [Migration guide](../../MIGRATION.md)
- [OpenAPI projection](../openapi/README.md)
- [Zod to TypeScript](../zod-to-ts/README.md)
- [Generated types and validators](../types/README.md)

## License

Apache 2.0 © Dennis Wentzien 2026
