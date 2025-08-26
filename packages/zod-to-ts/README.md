# 🔄✨ @rexeus/typeweaver-zod-to-ts

[![npm version](https://img.shields.io/npm/v/@rexeus/typeweaver-zod-to-ts.svg)](https://www.npmjs.com/package/@rexeus/typeweaver-zod-to-ts)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

This utility library provides logic for converting Zod `V4` schemas into TypeScript type
representations. It is used internally by typeweaver to generate TypeScript types from Zod schemas.

---

## 📥 Installation

```bash
npm install @rexeus/typeweaver-zod-to-ts
```

## 💡 Usage

```typescript
import { TsTypeNode, TsTypePrinter } from "@rexeus/typeweaver-zod-to-ts";
import { z } from "zod/4";

// Define a Zod schema
const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  age: z.number().optional(),
});

// Convert to TypeScript AST node
const typeNode = TsTypeNode.fromZod(userSchema);

// Print as TypeScript type string
const typeString = TsTypePrinter.print(typeNode);
// Output: { id: string; name: string; email: string; age?: number | undefined; }
```

## ✏️ Zod Type Support

### ✅ Supported Types

The library provides complete TypeScript type generation for the following Zod schema types:

- **Primitives**: `z.string()`, `z.number()`, `z.boolean()`, `z.date()`, `z.bigint()`, `z.symbol()`
- **Literals**: `z.literal()`, `z.enum()`
- **Collections**: `z.array()`, `z.record()`, `z.map()`, `z.set()`, `z.tuple()`
- **Objects**: `z.object()` with nested properties and optional fields
- **Unions**: `z.union()`
- **Intersections**: `z.intersection()`
- **Modifiers**: `z.optional()`, `z.nullable()`
- **Special types**: `z.unknown()`, `z.any()`, `z.void()`, `z.never()`, `z.null()`, `z.undefined()`
- **Async types**: `z.promise()`

### ⚠️ Unsupported Types

The following Zod types are not yet implemented and will fall back to `unknown` type:

- **Advanced types**: `z.lazy()`, `z.templateLiteral()`, `z.custom()`, `z.transform()`, `z.pipe()`
- **Modifiers**: `z.nonOptional()`, `z.readonly()`, `z.default()`, `z.catch()`
- **Special types**: `z.nan()`, `z.file()`, `z.success()`

> **Note**: When encountering unsupported Zod types, the library gracefully falls back to
> TypeScript's `unknown` type to maintain type safety.

## 🧵✨ About typeweaver

Typeweaver is a type-safe HTTP API framework built for API-first development with a focus on
developer experience. Use typeweaver to specify your HTTP APIs in TypeScript and Zod, and generate
clients, validators, routers, and more ✨

See more of [typeweaver](../cli/README.md)

## 📄 License

Apache 2.0 © Dennis Wentzien 2025
