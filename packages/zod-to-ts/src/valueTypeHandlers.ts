import { factory, SyntaxKind } from "@typescript/typescript6";
import {
  $ZodCatch,
  $ZodCustom,
  $ZodDefault,
  $ZodEnum,
  $ZodLazy,
  $ZodLiteral,
  $ZodNonOptional,
  $ZodNullable,
  $ZodOptional,
  $ZodPipe,
  $ZodPromise,
  $ZodReadonly,
  $ZodTemplateLiteral,
  $ZodTransform,
} from "zod/v4/core";
import { UnsupportedZodTypeError } from "./errors/UnsupportedZodTypeError.js";
import { fromZodEnum, fromZodLiteral } from "./literalType.js";
import { createReadonlyType, withoutUndefined } from "./typeTransforms.js";
import type { ZodTypeConverter } from "./converterTypes.js";
import type { TypeNode } from "@typescript/typescript6";
import type { $ZodType } from "zod/v4/core";

export function fromZodValue(
  zodType: $ZodType,
  convert: ZodTypeConverter
): TypeNode | undefined {
  if (zodType instanceof $ZodNullable) return fromZodNullable(zodType, convert);
  if (zodType instanceof $ZodLiteral) return fromZodLiteral(zodType);
  if (zodType instanceof $ZodEnum) return fromZodEnum(zodType);
  if (zodType instanceof $ZodPromise) return fromZodPromise(zodType, convert);
  if (zodType instanceof $ZodLazy) return fromZodLazy(zodType);
  if (zodType instanceof $ZodOptional) return fromZodOptional(zodType, convert);
  if (zodType instanceof $ZodDefault) return fromZodDefault(zodType, convert);
  if (zodType instanceof $ZodTemplateLiteral)
    return fromZodTemplateLiteral(zodType);
  return undefined;
}

export function fromZodTransformation(
  zodType: $ZodType,
  convert: ZodTypeConverter
): TypeNode | undefined {
  if (zodType instanceof $ZodCustom) return fromZodCustom(zodType);
  if (zodType instanceof $ZodTransform) return fromZodTransform(zodType);
  if (zodType instanceof $ZodNonOptional)
    return fromZodNonOptional(zodType, convert);
  if (zodType instanceof $ZodReadonly) return fromZodReadonly(zodType, convert);
  if (zodType instanceof $ZodPipe) return fromZodPipe(zodType, convert);
  if (zodType instanceof $ZodCatch) return fromZodCatch(zodType, convert);
  return undefined;
}

function fromZodNullable(
  schema: $ZodNullable,
  convert: ZodTypeConverter
): TypeNode {
  return factory.createUnionTypeNode([
    convert(schema._zod.def.innerType),
    factory.createLiteralTypeNode(factory.createNull()),
  ]);
}
function fromZodPromise(
  schema: $ZodPromise,
  convert: ZodTypeConverter
): TypeNode {
  return factory.createTypeReferenceNode(factory.createIdentifier("Promise"), [
    convert(schema._zod.def.innerType),
  ]);
}
function fromZodLazy(_schema: $ZodLazy): TypeNode {
  throw new UnsupportedZodTypeError(
    "lazy",
    "recursive schemas require named TypeScript declarations, which this converter does not emit"
  );
}
function fromZodOptional(
  schema: $ZodOptional,
  convert: ZodTypeConverter
): TypeNode {
  return factory.createUnionTypeNode([
    convert(schema._zod.def.innerType),
    factory.createKeywordTypeNode(SyntaxKind.UndefinedKeyword),
  ]);
}
function fromZodDefault(
  schema: $ZodDefault,
  convert: ZodTypeConverter
): TypeNode {
  return withoutUndefined(convert(schema._zod.def.innerType));
}
function fromZodTemplateLiteral(_schema: $ZodTemplateLiteral): TypeNode {
  throw new UnsupportedZodTypeError(
    "template-literal",
    "template-literal schemas are not represented by the current TypeScript AST generator"
  );
}
function fromZodCustom(_schema: $ZodCustom): TypeNode {
  throw new UnsupportedZodTypeError(
    "custom",
    "custom validators do not expose a statically inspectable output type"
  );
}
function fromZodTransform(_schema: $ZodTransform): TypeNode {
  throw new UnsupportedZodTypeError(
    "transform",
    "transforms do not expose a statically inspectable output type"
  );
}
function fromZodNonOptional(
  schema: $ZodNonOptional,
  convert: ZodTypeConverter
): TypeNode {
  return withoutUndefined(
    convert(schema._zod.def.innerType),
    factory.createKeywordTypeNode(SyntaxKind.NeverKeyword)
  );
}
function fromZodReadonly(
  schema: $ZodReadonly,
  convert: ZodTypeConverter
): TypeNode {
  return createReadonlyType(convert(schema._zod.def.innerType));
}
function fromZodPipe(schema: $ZodPipe, convert: ZodTypeConverter): TypeNode {
  return convert(schema._zod.def.out);
}
function fromZodCatch(schema: $ZodCatch, convert: ZodTypeConverter): TypeNode {
  return convert(schema._zod.def.innerType);
}
