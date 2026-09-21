import { factory, SyntaxKind } from "@typescript/typescript6";
import { fromZodIntrinsic } from "./intrinsicType.js";
import { fromZodPrimitive } from "./primitiveType.js";
import { fromZodStructure } from "./structureTypeHandlers.js";
import { fromZodTransformation, fromZodValue } from "./valueTypeHandlers.js";
import type { ZodTypeHandler } from "./converterTypes.js";
import type { TypeNode } from "@typescript/typescript6";
import type { $ZodType } from "zod/v4/core";
const HANDLERS: readonly ZodTypeHandler[] = [
  fromZodPrimitive,
  fromZodIntrinsic,
  fromZodStructure,
  fromZodValue,
  fromZodTransformation,
];
export function fromZod(zodType: $ZodType): TypeNode {
  for (const handler of HANDLERS) {
    const type = handler(zodType, fromZod);
    if (type !== undefined) return type;
  }
  return factory.createKeywordTypeNode(SyntaxKind.UnknownKeyword);
}
