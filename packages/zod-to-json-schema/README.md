# @rexeus/typeweaver-zod-to-json-schema

Converts Zod v4 schemas to JSON Schema Draft 2020-12-compatible objects. Typeweaver uses this
package as the reusable conversion layer for OpenAPI 3.1 generation, but it is intentionally
standalone.

## Install

```sh
pnpm add @rexeus/typeweaver-zod-to-json-schema zod
```

## Usage

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
//   properties: { id: { type: "string", format: "uuid" }, name: { type: "string" } },
//   required: ["id"],
//   additionalProperties: false
// }
```

`fromZod()` returns both the JSON Schema and deterministic warnings for Zod features that JSON
Schema cannot represent precisely, such as transforms, custom refinements, dates, maps, and sets.

```ts
const { schema, warnings } = fromZod(z.string().transform(value => value.length));

// schema falls back to a broad JSON Schema object when Zod cannot represent the
// runtime behavior exactly.
console.log(schema); // {}
console.log(warnings[0]?.code); // "unsupported-schema"
```

If Zod's conversion throws, `fromZod()` does not throw. It returns `{ schema: {}, warnings }` and
appends a `conversion-error` warning with the original error message.

Warning paths are JSON Pointer strings. When a warning corresponds to JSON Schema output, the path
points at that output location: the root path is `""`, object properties appear under
`/properties/name`, and record keys and values appear under `/propertyNames` and
`/additionalProperties`. Pointer segments escape `~` as `~0` and `/` as `~1`. Source-side Zod
concepts without a direct JSON Schema output location use stable Typeweaver extension paths under
the nearest output path, such as `/x-typeweaver/mapKey`, `/x-typeweaver/mapValue`,
`/x-typeweaver/pipeIn`, and `/x-typeweaver/pipeOut`. For example, a root pipe input is reported at
`/x-typeweaver/pipeIn`, while a `count` property pipe output is reported at
`/properties/count/x-typeweaver/pipeOut`.

Warnings include `schemaType` as best-effort diagnostic context from the source Zod schema. Treat it
as debugging detail, not a stable public API contract.

## Output

- Target dialect: JSON Schema Draft 2020-12.
- The root `$schema` marker from Zod's output is stripped for easier embedding in downstream OpenAPI
  documents.
- Tuple schemas are normalized with `minItems`. Fixed-length tuples also receive `items: {}` and
  `maxItems`; rest tuples preserve their `items` schema and do not receive a synthesized `maxItems`.
