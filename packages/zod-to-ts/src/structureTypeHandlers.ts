import { factory, SyntaxKind } from "@typescript/typescript6";
import {
  $ZodArray,
  $ZodIntersection,
  $ZodMap,
  $ZodObject,
  $ZodRecord,
  $ZodSet,
  $ZodTuple,
  $ZodUnion,
} from "zod/v4/core";
import { createTsAstPropertyKey } from "./propertyKey.js";
import type { ZodTypeConverter } from "./converterTypes.js";
import type { TypeElement, TypeNode } from "@typescript/typescript6";
import type { $ZodType } from "zod/v4/core";

export function fromZodStructure(
  zodType: $ZodType,
  convert: ZodTypeConverter
): TypeNode | undefined {
  if (zodType instanceof $ZodArray) return fromZodArray(zodType, convert);
  if (zodType instanceof $ZodObject) return fromZodObject(zodType, convert);
  if (zodType instanceof $ZodUnion) return fromZodUnion(zodType, convert);
  if (zodType instanceof $ZodIntersection)
    return fromZodIntersection(zodType, convert);
  if (zodType instanceof $ZodTuple) return fromZodTuple(zodType, convert);
  if (zodType instanceof $ZodRecord) return fromZodRecord(zodType, convert);
  if (zodType instanceof $ZodMap) return fromZodMap(zodType, convert);
  if (zodType instanceof $ZodSet) return fromZodSet(zodType, convert);
  return undefined;
}

function fromZodArray(
  zodArray: $ZodArray,
  convert: ZodTypeConverter
): TypeNode {
  return factory.createArrayTypeNode(convert(zodArray._zod.def.element));
}

function fromZodObject(
  zodObject: $ZodObject,
  convert: ZodTypeConverter
): TypeNode {
  const members: TypeElement[] = Object.entries(zodObject._zod.def.shape).map(
    ([key, nextZodNode]) => {
      const type = convert(nextZodNode);
      if (!nextZodNode._zod?.def) {
        console.warn(
          `Zod node for key "${key}" does not have a _zod.def property. This may indicate an issue with the Zod schema.`,
          { key }
        );
      }
      return factory.createPropertySignature(
        undefined,
        createTsAstPropertyKey(key),
        nextZodNode._zod?.optout === "optional"
          ? factory.createToken(SyntaxKind.QuestionToken)
          : undefined,
        type
      );
    }
  );
  return factory.createTypeLiteralNode(members);
}

function fromZodUnion(
  zodUnion: $ZodUnion,
  convert: ZodTypeConverter
): TypeNode {
  return factory.createUnionTypeNode(zodUnion._zod.def.options.map(convert));
}

function fromZodIntersection(
  zodIntersection: $ZodIntersection,
  convert: ZodTypeConverter
): TypeNode {
  return factory.createIntersectionTypeNode([
    convert(zodIntersection._zod.def.left),
    convert(zodIntersection._zod.def.right),
  ]);
}

function fromZodTuple(
  zodTuple: $ZodTuple,
  convert: ZodTypeConverter
): TypeNode {
  const elements = zodTuple._zod.def.items.map(convert);
  if (zodTuple._zod.def.rest) {
    elements.push(
      factory.createRestTypeNode(
        factory.createArrayTypeNode(convert(zodTuple._zod.def.rest))
      )
    );
  }
  return factory.createTupleTypeNode(elements);
}

function fromZodRecord(
  zodRecord: $ZodRecord,
  convert: ZodTypeConverter
): TypeNode {
  return factory.createTypeReferenceNode(factory.createIdentifier("Record"), [
    convert(zodRecord._zod.def.keyType),
    convert(zodRecord._zod.def.valueType),
  ]);
}

function fromZodMap(zodMap: $ZodMap, convert: ZodTypeConverter): TypeNode {
  return factory.createTypeReferenceNode(factory.createIdentifier("Map"), [
    convert(zodMap._zod.def.keyType),
    convert(zodMap._zod.def.valueType),
  ]);
}

function fromZodSet(zodSet: $ZodSet, convert: ZodTypeConverter): TypeNode {
  return factory.createTypeReferenceNode(factory.createIdentifier("Set"), [
    convert(zodSet._zod.def.valueType),
  ]);
}
