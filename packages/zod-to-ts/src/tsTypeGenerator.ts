import { factory, SyntaxKind } from "@typescript/typescript6";
import {
  $ZodArray,
  $ZodCatch,
  $ZodCustom,
  $ZodDefault,
  $ZodEnum,
  $ZodIntersection,
  $ZodLazy,
  $ZodLiteral,
  $ZodMap,
  $ZodNonOptional,
  $ZodNullable,
  $ZodObject,
  $ZodOptional,
  $ZodPipe,
  $ZodPromise,
  $ZodReadonly,
  $ZodRecord,
  $ZodSet,
  $ZodTemplateLiteral,
  $ZodTransform,
  $ZodTuple,
  $ZodUnion,
} from "zod/v4/core";
import { UnsupportedZodTypeError } from "./errors/UnsupportedZodTypeError.js";
import { fromZodIntrinsic } from "./intrinsicType.js";
import { fromZodEnum, fromZodLiteral } from "./literalType.js";
import { fromZodPrimitive } from "./primitiveType.js";
import { createTsAstPropertyKey } from "./propertyKey.js";
import { createReadonlyType, withoutUndefined } from "./typeTransforms.js";
import type { TypeElement, TypeNode } from "@typescript/typescript6";
import type { $ZodType } from "zod/v4/core";

type ZodTypeHandler = (zodType: $ZodType) => TypeNode | undefined;

const ZOD_TYPE_HANDLERS: readonly ZodTypeHandler[] = [
  fromZodPrimitive,
  fromZodIntrinsic,
  fromZodStructure,
  fromZodValue,
  fromZodTransformation,
];

export function fromZod(zodType: $ZodType): TypeNode {
  for (const handler of ZOD_TYPE_HANDLERS) {
    const type = handler(zodType);
    if (type !== undefined) {
      return type;
    }
  }

  return factory.createKeywordTypeNode(SyntaxKind.UnknownKeyword);
}

function fromZodStructure(zodType: $ZodType): TypeNode | undefined {
  if (zodType instanceof $ZodArray) {
    return fromZodArray(zodType);
  }
  if (zodType instanceof $ZodObject) {
    return fromZodObject(zodType);
  }
  if (zodType instanceof $ZodUnion) {
    return fromZodUnion(zodType);
  }
  if (zodType instanceof $ZodIntersection) {
    return fromZodIntersection(zodType);
  }
  if (zodType instanceof $ZodTuple) {
    return fromZodTuple(zodType);
  }
  if (zodType instanceof $ZodRecord) {
    return fromZodRecord(zodType);
  }
  if (zodType instanceof $ZodMap) {
    return fromZodMap(zodType);
  }
  if (zodType instanceof $ZodSet) {
    return fromZodSet(zodType);
  }

  return undefined;
}

function fromZodValue(zodType: $ZodType): TypeNode | undefined {
  if (zodType instanceof $ZodNullable) {
    return fromZodNullable(zodType);
  }
  if (zodType instanceof $ZodLiteral) {
    return fromZodLiteral(zodType);
  }
  if (zodType instanceof $ZodEnum) {
    return fromZodEnum(zodType);
  }
  if (zodType instanceof $ZodPromise) {
    return fromZodPromise(zodType);
  }
  if (zodType instanceof $ZodLazy) {
    return fromZodLazy(zodType);
  }
  if (zodType instanceof $ZodOptional) {
    return fromZodOptional(zodType);
  }
  if (zodType instanceof $ZodDefault) {
    return fromZodDefault(zodType);
  }
  if (zodType instanceof $ZodTemplateLiteral) {
    return fromZodTemplateLiteral(zodType);
  }

  return undefined;
}

function fromZodTransformation(zodType: $ZodType): TypeNode | undefined {
  if (zodType instanceof $ZodCustom) {
    return fromZodCustom(zodType);
  }
  if (zodType instanceof $ZodTransform) {
    return fromZodTransform(zodType);
  }
  if (zodType instanceof $ZodNonOptional) {
    return fromZodNonOptional(zodType);
  }
  if (zodType instanceof $ZodReadonly) {
    return fromZodReadonly(zodType);
  }
  if (zodType instanceof $ZodPipe) {
    return fromZodPipe(zodType);
  }
  if (zodType instanceof $ZodCatch) {
    return fromZodCatch(zodType);
  }

  return undefined;
}

function fromZodNullable(zodNullable: $ZodNullable): TypeNode {
  const innerType = fromZod(zodNullable._zod.def.innerType);
  return factory.createUnionTypeNode([
    innerType,
    factory.createLiteralTypeNode(factory.createNull()),
  ]);
}

function fromZodArray(zodArray: $ZodArray): TypeNode {
  const innerType = fromZod(zodArray._zod.def.element);
  return factory.createArrayTypeNode(innerType);
}

function fromZodObject(zodObject: $ZodObject): TypeNode {
  const entries = Object.entries(zodObject._zod.def.shape);

  const members: TypeElement[] = entries.map(([key, nextZodNode]) => {
    const type = fromZod(nextZodNode);

    if (!nextZodNode._zod?.def) {
      console.warn(
        `Zod node for key "${key}" does not have a _zod.def property. This may indicate an issue with the Zod schema.`,
        {
          key,
        }
      );
    }
    const isOptional = nextZodNode._zod?.optout === "optional";

    const propertySignature = factory.createPropertySignature(
      undefined,
      createTsAstPropertyKey(key),
      isOptional ? factory.createToken(SyntaxKind.QuestionToken) : undefined,
      type
    );

    // TODO: add description?
    return propertySignature;
  });
  return factory.createTypeLiteralNode(members);
}

function fromZodUnion(zodUnion: $ZodUnion): TypeNode {
  const options = zodUnion._zod.def.options.map(fromZod);
  return factory.createUnionTypeNode(options);
}

function fromZodIntersection(zodIntersection: $ZodIntersection): TypeNode {
  const left = fromZod(zodIntersection._zod.def.left);
  const right = fromZod(zodIntersection._zod.def.right);
  return factory.createIntersectionTypeNode([left, right]);
}

function fromZodTuple(zodTuple: $ZodTuple): TypeNode {
  const elements = zodTuple._zod.def.items.map(fromZod);
  const { rest } = zodTuple._zod.def;

  if (rest) {
    elements.push(
      factory.createRestTypeNode(factory.createArrayTypeNode(fromZod(rest)))
    );
  }

  return factory.createTupleTypeNode(elements);
}

function fromZodRecord(zodRecord: $ZodRecord): TypeNode {
  const keyType = fromZod(zodRecord._zod.def.keyType);
  const valueType = fromZod(zodRecord._zod.def.valueType);
  return factory.createTypeReferenceNode(factory.createIdentifier("Record"), [
    keyType,
    valueType,
  ]);
}

function fromZodMap(zodMap: $ZodMap): TypeNode {
  const keyType = fromZod(zodMap._zod.def.keyType);
  const valueType = fromZod(zodMap._zod.def.valueType);
  return factory.createTypeReferenceNode(factory.createIdentifier("Map"), [
    keyType,
    valueType,
  ]);
}

function fromZodSet(zodSet: $ZodSet): TypeNode {
  const innerType = fromZod(zodSet._zod.def.valueType);
  return factory.createTypeReferenceNode(factory.createIdentifier("Set"), [
    innerType,
  ]);
}

function fromZodPromise(zodPromise: $ZodPromise): TypeNode {
  const innerType = fromZod(zodPromise._zod.def.innerType);
  return factory.createTypeReferenceNode(factory.createIdentifier("Promise"), [
    innerType,
  ]);
}

function fromZodLazy(_zodLazy: $ZodLazy): TypeNode {
  throw new UnsupportedZodTypeError(
    "lazy",
    "recursive schemas require named TypeScript declarations, which this converter does not emit"
  );
}

function fromZodOptional(zodOptional: $ZodOptional): TypeNode {
  const innerType = fromZod(zodOptional._zod.def.innerType);
  return factory.createUnionTypeNode([
    innerType,
    factory.createKeywordTypeNode(SyntaxKind.UndefinedKeyword),
  ]);
}

function fromZodDefault(zodDefault: $ZodDefault): TypeNode {
  const innerType = fromZod(zodDefault._zod.def.innerType);
  return withoutUndefined(innerType);
}

function fromZodTemplateLiteral(
  _zodTemplateLiteral: $ZodTemplateLiteral
): TypeNode {
  throw new UnsupportedZodTypeError(
    "template-literal",
    "template-literal schemas are not represented by the current TypeScript AST generator"
  );
}

function fromZodCustom(_zodCustom: $ZodCustom): TypeNode {
  throw new UnsupportedZodTypeError(
    "custom",
    "custom validators do not expose a statically inspectable output type"
  );
}

function fromZodTransform(_zodTransform: $ZodTransform): TypeNode {
  throw new UnsupportedZodTypeError(
    "transform",
    "transforms do not expose a statically inspectable output type"
  );
}

function fromZodNonOptional(zodNonOptional: $ZodNonOptional): TypeNode {
  const innerType = fromZod(zodNonOptional._zod.def.innerType);
  return withoutUndefined(
    innerType,
    factory.createKeywordTypeNode(SyntaxKind.NeverKeyword)
  );
}

function fromZodReadonly(zodReadonly: $ZodReadonly): TypeNode {
  return createReadonlyType(fromZod(zodReadonly._zod.def.innerType));
}

function fromZodPipe(zodPipe: $ZodPipe): TypeNode {
  return fromZod(zodPipe._zod.def.out);
}

function fromZodCatch(zodCatch: $ZodCatch): TypeNode {
  return fromZod(zodCatch._zod.def.innerType);
}
