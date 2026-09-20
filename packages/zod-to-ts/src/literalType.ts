import { factory, SyntaxKind } from "@typescript/typescript6";
import { $ZodEnum, $ZodLiteral } from "zod/v4/core";
import { EmptyZodLiteralError } from "./errors/EmptyZodLiteralError.js";
import { UnsupportedLiteralValueError } from "./errors/UnsupportedLiteralValueError.js";
import type { TypeNode } from "@typescript/typescript6";

type LiteralValue = string | number | boolean | bigint | null | undefined;

export function fromZodLiteral(zodLiteral: $ZodLiteral): TypeNode {
  if (zodLiteral._zod.def.values.length === 0) {
    throw new EmptyZodLiteralError();
  }
  const types = zodLiteral._zod.def.values.map(fromLiteralValue);

  const [type] = types;
  if (types.length === 1 && type) {
    return type;
  }

  return factory.createUnionTypeNode(types);
}

export function fromZodEnum(zodEnum: $ZodEnum): TypeNode {
  const values = getZodEnumValues(zodEnum._zod.def.entries);
  const types = values.map(fromLiteralValue);
  return factory.createUnionTypeNode(types);
}

function fromLiteralValue(value: LiteralValue): TypeNode {
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
      factory.createBigIntLiteral(`${value.toString()}n`)
    );
  }
  if (value === null) {
    return factory.createLiteralTypeNode(factory.createNull());
  }
  if (value === undefined) {
    return factory.createKeywordTypeNode(SyntaxKind.UndefinedKeyword);
  }

  throw new UnsupportedLiteralValueError(typeof value);
}

function getZodEnumValues(
  entries: Record<string, string | number>
): Array<string | number> {
  const numericValues = Object.values(entries).filter(
    (value): value is number => typeof value === "number"
  );

  return Object.entries(entries)
    .filter(([key]) => !numericValues.includes(Number(key)))
    .map(([, value]) => value);
}
