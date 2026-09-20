import { factory, SyntaxKind } from "@typescript/typescript6";
import {
  $ZodBigInt,
  $ZodBoolean,
  $ZodDate,
  $ZodNull,
  $ZodNumber,
  $ZodString,
  $ZodSymbol,
  $ZodUndefined,
} from "zod/v4/core";
import type { TypeNode } from "@typescript/typescript6";
import type { $ZodType } from "zod/v4/core";

export function fromZodPrimitive(zodType: $ZodType): TypeNode | undefined {
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
  if (zodType instanceof $ZodNull) {
    return fromZodNull(zodType);
  }

  return undefined;
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

function fromZodNull(_zodNull: $ZodNull): TypeNode {
  return factory.createLiteralTypeNode(factory.createNull());
}
