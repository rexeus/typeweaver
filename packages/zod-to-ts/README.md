# @rexeus/typeweaver-zod-to-ts

Generates TypeScript types from Zod schemas.

## Overview

This package provides utilities to transform Zod schemas into TypeScript type representations. It's
used internally by TypeWeaver framework.

## Features

- Converts Zod schemas to TypeScript AST nodes
- Prints TypeScript type definitions from Zod schemas
- Supports all common Zod types (string, number, boolean, object, array, union, etc.)

## Installation

```bash
npm install @rexeus/typeweaver-zod-to-ts
```

## Usage

```typescript
import { TsTypeNode, TsTypePrinter } from "@rexeus/typeweaver-zod-to-ts";
import { z } from "zod/v4";

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

## API

### TsTypeNode

- `static fromZod(zodType: $ZodType): TypeNode` - Converts a Zod schema to a TypeScript AST node

### TsTypePrinter

- `static print(tsType: TypeNode): string` - Converts a TypeScript AST node to a string
  representation

## License

ISC
