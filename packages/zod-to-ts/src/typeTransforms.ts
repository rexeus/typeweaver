import {
  factory,
  isArrayTypeNode,
  isIdentifier,
  isLiteralTypeNode,
  isParenthesizedTypeNode,
  isTupleTypeNode,
  isTypeReferenceNode,
  isUnionTypeNode,
  SyntaxKind,
} from "@typescript/typescript6";
import type { TypeNode, TypeReferenceNode } from "@typescript/typescript6";

export function withoutUndefined(
  type: TypeNode,
  fallbackType: TypeNode = type
): TypeNode {
  if (isParenthesizedTypeNode(type)) {
    return withoutUndefined(type.type, fallbackType);
  }

  if (type.kind === SyntaxKind.UndefinedKeyword) {
    return fallbackType;
  }

  if (!isUnionTypeNode(type)) {
    return type;
  }

  const types = type.types
    .map(nextType => withoutUndefined(nextType))
    .flatMap(nextType =>
      isUnionTypeNode(nextType) ? Array.from(nextType.types) : [nextType]
    )
    .filter(nextType => nextType.kind !== SyntaxKind.UndefinedKeyword);

  const [singleType] = types;
  if (types.length === 0) {
    return fallbackType;
  }
  if (types.length === 1 && singleType) {
    return singleType;
  }

  return factory.createUnionTypeNode(types);
}

export function createReadonlyType(type: TypeNode): TypeNode {
  if (isParenthesizedTypeNode(type)) {
    return createReadonlyType(type.type);
  }

  if (isUnionTypeNode(type)) {
    return factory.createUnionTypeNode(type.types.map(createReadonlyType));
  }

  if (isArrayTypeNode(type) || isTupleTypeNode(type)) {
    return factory.createTypeOperatorNode(SyntaxKind.ReadonlyKeyword, type);
  }

  if (isReadonlyPrimitiveType(type) || isLiteralTypeNode(type)) {
    return type;
  }

  if (isTypeReferenceNode(type)) {
    return createReadonlyReferenceType(type);
  }

  return wrapInReadonly(type);
}

function createReadonlyReferenceType(type: TypeReferenceNode): TypeNode {
  const typeName = isIdentifier(type.typeName)
    ? type.typeName.escapedText.toString()
    : undefined;

  if (typeName === "Map") {
    return factory.createTypeReferenceNode(
      factory.createIdentifier("ReadonlyMap"),
      type.typeArguments
    );
  }

  if (typeName === "Set") {
    return factory.createTypeReferenceNode(
      factory.createIdentifier("ReadonlySet"),
      type.typeArguments
    );
  }

  if (typeName === "Date" || typeName === "Promise") {
    return type;
  }

  return wrapInReadonly(type);
}

function wrapInReadonly(type: TypeNode): TypeNode {
  return factory.createTypeReferenceNode(factory.createIdentifier("Readonly"), [
    type,
  ]);
}

function isReadonlyPrimitiveType(type: TypeNode): boolean {
  return [
    SyntaxKind.AnyKeyword,
    SyntaxKind.BigIntKeyword,
    SyntaxKind.BooleanKeyword,
    SyntaxKind.NeverKeyword,
    SyntaxKind.NumberKeyword,
    SyntaxKind.StringKeyword,
    SyntaxKind.SymbolKeyword,
    SyntaxKind.UndefinedKeyword,
    SyntaxKind.UnknownKeyword,
    SyntaxKind.VoidKeyword,
  ].includes(type.kind);
}
