import { factory, SyntaxKind } from "typescript";
import {
  $ZodAny,
  $ZodArray,
  $ZodBigInt,
  $ZodBoolean,
  $ZodCatch,
  $ZodCustom,
  $ZodDate,
  $ZodDefault,
  $ZodEnum,
  $ZodFile,
  $ZodIntersection,
  $ZodLazy,
  $ZodLiteral,
  $ZodMap,
  $ZodNaN,
  $ZodNever,
  $ZodNonOptional,
  $ZodNull,
  $ZodNullable,
  $ZodNumber,
  $ZodObject,
  $ZodOptional,
  $ZodPipe,
  $ZodPromise,
  $ZodReadonly,
  $ZodRecord,
  $ZodSet,
  $ZodString,
  $ZodSuccess,
  $ZodSymbol,
  $ZodTemplateLiteral,
  $ZodTransform,
  $ZodTuple,
  $ZodUndefined,
  $ZodUnion,
  $ZodUnknown,
  $ZodVoid,
} from "zod/v4/core";
import type {
  Identifier,
  Node,
  StringLiteral,
  TypeElement,
  TypeNode,
} from "typescript";
import type { $ZodType } from "zod/v4/core";

const RESERVED_KEYWORDS = new Set([
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "new",
  "null",
  "return",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
  "as",
  "implements",
  "interface",
  "let",
  "package",
  "private",
  "protected",
  "public",
  "static",
  "any",
  "boolean",
  "constructor",
  "declare",
  "get",
  "module",
  "require",
  "number",
  "set",
  "string",
  "symbol",
  "type",
  "from",
  "of",
]);

const IDENTIFIER_PATTERN = /^[$A-Z_a-z][\w$]*$/u;

export function fromZod(zodType: $ZodType): TypeNode {
  if (zodType instanceof $ZodString) {
    return fromZodString(zodType);
  }
  if (zodType instanceof $ZodNumber) {
    return fromZodNumber(zodType);
  }
  if (zodType instanceof $ZodBigInt) {
    return fromZodBigInt(zodType);
  }
  if (zodType instanceof $ZodBoolean) {
    return fromZodBoolean(zodType);
  }
  if (zodType instanceof $ZodDate) {
    return fromZodDate(zodType);
  }
  if (zodType instanceof $ZodSymbol) {
    return fromZodSymbol(zodType);
  }
  if (zodType instanceof $ZodUndefined) {
    return fromZodUndefined(zodType);
  }
  if (zodType instanceof $ZodNullable) {
    return fromZodNullable(zodType);
  }
  if (zodType instanceof $ZodNull) {
    return fromZodNull(zodType);
  }
  if (zodType instanceof $ZodAny) {
    return fromZodAny(zodType);
  }
  if (zodType instanceof $ZodUnknown) {
    return fromZodUnknown(zodType);
  }
  if (zodType instanceof $ZodNever) {
    return fromZodNever(zodType);
  }
  if (zodType instanceof $ZodVoid) {
    return fromZodVoid(zodType);
  }
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
  if (zodType instanceof $ZodNaN) {
    return fromZodNaN(zodType);
  }
  if (zodType instanceof $ZodPipe) {
    return fromZodPipe(zodType);
  }
  if (zodType instanceof $ZodSuccess) {
    return fromZodSuccess(zodType);
  }
  if (zodType instanceof $ZodCatch) {
    return fromZodCatch(zodType);
  }
  if (zodType instanceof $ZodFile) {
    return fromZodFile(zodType);
  }

  return factory.createKeywordTypeNode(SyntaxKind.UnknownKeyword);
}

function fromZodString(_zodString: $ZodString): TypeNode {
  return factory.createKeywordTypeNode(SyntaxKind.StringKeyword);
}

function fromZodNumber(_zodNumber: $ZodNumber): TypeNode {
  return factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
}

function fromZodBigInt(_zodBigInt: $ZodBigInt): TypeNode {
  return factory.createKeywordTypeNode(SyntaxKind.BigIntKeyword);
}

function fromZodBoolean(_zodBoolean: $ZodBoolean): TypeNode {
  return factory.createKeywordTypeNode(SyntaxKind.BooleanKeyword);
}

function fromZodDate(_zodDate: $ZodDate): TypeNode {
  return factory.createTypeReferenceNode(factory.createIdentifier("Date"));
}

function fromZodSymbol(_zodSymbol: $ZodSymbol): TypeNode {
  return factory.createKeywordTypeNode(SyntaxKind.SymbolKeyword);
}

function fromZodUndefined(_zodUndefined: $ZodUndefined): TypeNode {
  return factory.createKeywordTypeNode(SyntaxKind.UndefinedKeyword);
}

function fromZodNullable(zodNullable: $ZodNullable): TypeNode {
  const innerType = fromZod(zodNullable._zod.def.innerType);
  return factory.createUnionTypeNode([
    innerType,
    factory.createLiteralTypeNode(factory.createNull()),
  ]);
}

function fromZodNull(_zodNull: $ZodNull): TypeNode {
  return factory.createLiteralTypeNode(factory.createNull());
}

function fromZodAny(_zodAny: $ZodAny): TypeNode {
  return factory.createKeywordTypeNode(SyntaxKind.AnyKeyword);
}

function fromZodUnknown(_zodUnknown: $ZodUnknown): TypeNode {
  return factory.createKeywordTypeNode(SyntaxKind.UnknownKeyword);
}

function fromZodNever(_zodNever: $ZodNever): TypeNode {
  return factory.createKeywordTypeNode(SyntaxKind.NeverKeyword);
}

function fromZodVoid(_zodVoid: $ZodVoid): TypeNode {
  return factory.createKeywordTypeNode(SyntaxKind.VoidKeyword);
}

function fromZodArray(zodArray: $ZodArray): TypeNode {
  const innerType = fromZod(zodArray._zod.def.element);
  return factory.createArrayTypeNode(innerType);
}

function fromZodObject(zodObject: $ZodObject): TypeNode {
  const entries = Object.entries(zodObject._zod.def.shape);

  const members: TypeElement[] = entries.map(([key, nextZodNode]) => {
    const type = fromZod(nextZodNode);
    const isOptional = nextZodNode._zod.def.type === "optional";

    return factory.createPropertySignature(
      undefined,
      createTsAstPropertyKey(key),
      isOptional ? factory.createToken(SyntaxKind.QuestionToken) : undefined,
      type
    );
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

function fromZodLiteral(zodLiteral: $ZodLiteral): TypeNode {
  if (zodLiteral._zod.def.values.length === 0) {
    throw new Error("ZodLiteral has no values");
  }

  const value = zodLiteral._zod.def.values[0];

  if (typeof value === "string") {
    return factory.createLiteralTypeNode(factory.createStringLiteral(value));
  }
  if (typeof value === "number") {
    return factory.createLiteralTypeNode(factory.createNumericLiteral(value));
  }
  if (typeof value === "boolean") {
    return factory.createLiteralTypeNode(
      value ? factory.createTrue() : factory.createFalse()
    );
  }
  if (typeof value === "bigint") {
    return factory.createLiteralTypeNode(
      factory.createBigIntLiteral(value.toString())
    );
  }
  if (value === null) {
    return factory.createLiteralTypeNode(factory.createNull());
  }
  if (value === undefined) {
    return factory.createKeywordTypeNode(SyntaxKind.UndefinedKeyword);
  }

  throw new Error(`Unsupported literal type: ${typeof value}`);
}

function fromZodEnum(zodEnum: $ZodEnum): TypeNode {
  const entries = Object.entries(zodEnum._zod.def.entries);
  const types = entries.map(([key]) => {
    return factory.createLiteralTypeNode(factory.createStringLiteral(key));
  });
  return factory.createUnionTypeNode(types);
}

function fromZodPromise(zodPromise: $ZodPromise): TypeNode {
  const innerType = fromZod(zodPromise._zod.def.innerType);
  return factory.createTypeReferenceNode(factory.createIdentifier("Promise"), [
    innerType,
  ]);
}

function fromZodLazy(_zodLazy: $ZodLazy): TypeNode {
  return factory.createKeywordTypeNode(SyntaxKind.UnknownKeyword);
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
  const filteredNodes: Node[] = [];

  innerType.forEachChild(node => {
    if (node.kind !== SyntaxKind.UndefinedKeyword) {
      filteredNodes.push(node);
    }
  });

  // @ts-expect-error TypeScript AST nodes do not expose a typed setter for children.
  innerType.types = filteredNodes;
  return innerType;
}

function fromZodTemplateLiteral(
  _zodTemplateLiteral: $ZodTemplateLiteral
): TypeNode {
  return factory.createKeywordTypeNode(SyntaxKind.UnknownKeyword);
}

function fromZodCustom(_zodCustom: $ZodCustom): TypeNode {
  return factory.createKeywordTypeNode(SyntaxKind.UnknownKeyword);
}

function fromZodTransform(_zodTransform: $ZodTransform): TypeNode {
  return factory.createKeywordTypeNode(SyntaxKind.UnknownKeyword);
}

function fromZodNonOptional(_zodNonOptional: $ZodNonOptional): TypeNode {
  return factory.createKeywordTypeNode(SyntaxKind.UnknownKeyword);
}

function fromZodReadonly(_zodReadonly: $ZodReadonly): TypeNode {
  return factory.createKeywordTypeNode(SyntaxKind.UnknownKeyword);
}

function fromZodNaN(_zodNaN: $ZodNaN): TypeNode {
  return factory.createKeywordTypeNode(SyntaxKind.UnknownKeyword);
}

function fromZodPipe(_zodPipe: $ZodPipe): TypeNode {
  return factory.createKeywordTypeNode(SyntaxKind.UnknownKeyword);
}

function fromZodSuccess(_zodSuccess: $ZodSuccess): TypeNode {
  return factory.createKeywordTypeNode(SyntaxKind.UnknownKeyword);
}

function fromZodCatch(_zodCatch: $ZodCatch): TypeNode {
  return factory.createKeywordTypeNode(SyntaxKind.UnknownKeyword);
}

function fromZodFile(_zodFile: $ZodFile): TypeNode {
  return factory.createKeywordTypeNode(SyntaxKind.UnknownKeyword);
}

function createTsAstPropertyKey(key: string): Identifier | StringLiteral {
  if (IDENTIFIER_PATTERN.test(key) && !RESERVED_KEYWORDS.has(key)) {
    return factory.createIdentifier(key);
  }

  return factory.createStringLiteral(key);
}
