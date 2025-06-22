import {
  factory,
  SyntaxKind,
  type Identifier,
  type Node,
  type StringLiteral,
  type TypeElement,
  type TypeNode,
} from "typescript";
import {
  type $ZodType,
  $ZodString,
  $ZodNumber,
  $ZodBoolean,
  $ZodUndefined,
  $ZodNull,
  $ZodVoid,
  $ZodAny,
  $ZodBigInt,
  $ZodDate,
  $ZodNever,
  $ZodUnknown,
  $ZodLiteral,
  $ZodUnion,
  $ZodEnum,
  $ZodFile,
  $ZodSuccess,
  $ZodReadonly,
  $ZodCustom,
  $ZodPromise,
  $ZodIntersection,
  $ZodSymbol,
  $ZodNullable,
  $ZodArray,
  $ZodObject,
  $ZodRecord,
  $ZodTuple,
  $ZodSet,
  $ZodMap,
  $ZodLazy,
  $ZodOptional,
  $ZodTemplateLiteral,
  $ZodNonOptional,
  $ZodTransform,
  $ZodDefault,
  $ZodCatch,
  $ZodPipe,
  $ZodNaN,
} from "zod/v4/core";

export class TsTypeNode {
  static fromZod(zodType: $ZodType): TypeNode {
    if (zodType instanceof $ZodString) {
      return TsTypeNode.fromZodString(zodType);
    }
    if (zodType instanceof $ZodNumber) {
      return TsTypeNode.fromZodNumber(zodType);
    }
    if (zodType instanceof $ZodBigInt) {
      return TsTypeNode.fromZodBigInt(zodType);
    }
    if (zodType instanceof $ZodBoolean) {
      return TsTypeNode.fromZodBoolean(zodType);
    }
    if (zodType instanceof $ZodDate) {
      return TsTypeNode.fromZodDate(zodType);
    }
    if (zodType instanceof $ZodSymbol) {
      return TsTypeNode.fromZodSymbol(zodType);
    }
    if (zodType instanceof $ZodUndefined) {
      return TsTypeNode.fromZodUndefined(zodType);
    }
    if (zodType instanceof $ZodNullable) {
      return TsTypeNode.fromZodNullable(zodType);
    }
    if (zodType instanceof $ZodNull) {
      return TsTypeNode.fromZodNull(zodType);
    }
    if (zodType instanceof $ZodAny) {
      return TsTypeNode.fromZodAny(zodType);
    }
    if (zodType instanceof $ZodUnknown) {
      return TsTypeNode.fromZodUnknown(zodType);
    }
    if (zodType instanceof $ZodNever) {
      return TsTypeNode.fromZodNever(zodType);
    }
    if (zodType instanceof $ZodVoid) {
      return TsTypeNode.fromZodVoid(zodType);
    }
    if (zodType instanceof $ZodArray) {
      return TsTypeNode.fromZodArray(zodType);
    }
    if (zodType instanceof $ZodObject) {
      return TsTypeNode.fromZodObject(zodType);
    }
    if (zodType instanceof $ZodUnion) {
      return TsTypeNode.fromZodUnion(zodType);
    }
    if (zodType instanceof $ZodIntersection) {
      return TsTypeNode.fromZodIntersection(zodType);
    }
    if (zodType instanceof $ZodTuple) {
      return TsTypeNode.fromZodTuple(zodType);
    }
    if (zodType instanceof $ZodRecord) {
      return TsTypeNode.fromZodRecord(zodType);
    }
    if (zodType instanceof $ZodMap) {
      return TsTypeNode.fromZodMap(zodType);
    }
    if (zodType instanceof $ZodSet) {
      return TsTypeNode.fromZodSet(zodType);
    }
    if (zodType instanceof $ZodLiteral) {
      if (!TsTypeNode) {
        throw new Error("ZodLiteral has no values");
      }
      return TsTypeNode.fromZodLiteral(zodType);
    }
    if (zodType instanceof $ZodEnum) {
      return TsTypeNode.fromZodEnum(zodType);
    }
    if (zodType instanceof $ZodPromise) {
      return TsTypeNode.fromZodPromise(zodType);
    }
    if (zodType instanceof $ZodLazy) {
      return TsTypeNode.fromZodLazy(zodType);
    }
    if (zodType instanceof $ZodOptional) {
      return TsTypeNode.fromZodOptional(zodType);
    }
    if (zodType instanceof $ZodDefault) {
      return TsTypeNode.fromZodDefault(zodType);
    }
    if (zodType instanceof $ZodTemplateLiteral) {
      return TsTypeNode.fromZodTemplateLiteral(zodType);
    }
    if (zodType instanceof $ZodCustom) {
      return TsTypeNode.fromZodCustom(zodType);
    }
    if (zodType instanceof $ZodTransform) {
      return TsTypeNode.fromZodTransform(zodType);
    }
    if (zodType instanceof $ZodNonOptional) {
      return TsTypeNode.fromZodNonOptional(zodType);
    }
    if (zodType instanceof $ZodReadonly) {
      return TsTypeNode.fromZodReadonly(zodType);
    }
    if (zodType instanceof $ZodNaN) {
      return TsTypeNode.fromZodNaN(zodType);
    }
    if (zodType instanceof $ZodPipe) {
      return TsTypeNode.fromZodPipe(zodType);
    }
    if (zodType instanceof $ZodSuccess) {
      return TsTypeNode.fromZodSuccess(zodType);
    }
    if (zodType instanceof $ZodCatch) {
      return TsTypeNode.fromZodCatch(zodType);
    }
    if (zodType instanceof $ZodFile) {
      return TsTypeNode.fromZodFile(zodType);
    }

    return factory.createKeywordTypeNode(SyntaxKind.UnknownKeyword);
  }

  private static fromZodString(zodString: $ZodString): TypeNode {
    return factory.createKeywordTypeNode(SyntaxKind.StringKeyword);
  }

  private static fromZodNumber(zodNumber: $ZodNumber): TypeNode {
    return factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
  }

  private static fromZodBigInt(zodBigInt: $ZodBigInt): TypeNode {
    return factory.createKeywordTypeNode(SyntaxKind.BigIntKeyword);
  }

  private static fromZodBoolean(zodBoolean: $ZodBoolean): TypeNode {
    return factory.createKeywordTypeNode(SyntaxKind.BooleanKeyword);
  }

  private static fromZodDate(zodDate: $ZodDate): TypeNode {
    return factory.createTypeReferenceNode(factory.createIdentifier("Date"));
  }

  private static fromZodSymbol(zodSymbol: $ZodSymbol): TypeNode {
    return factory.createKeywordTypeNode(SyntaxKind.SymbolKeyword);
  }

  private static fromZodUndefined(zodUndefined: $ZodUndefined): TypeNode {
    return factory.createKeywordTypeNode(SyntaxKind.UndefinedKeyword);
  }

  private static fromZodNullable(zodNullable: $ZodNullable): TypeNode {
    const innerType = TsTypeNode.fromZod(zodNullable._zod.def.innerType);
    return factory.createUnionTypeNode([
      innerType,
      factory.createLiteralTypeNode(factory.createNull()),
    ]);
  }

  private static fromZodNull(zodNull: $ZodNull): TypeNode {
    return factory.createLiteralTypeNode(factory.createNull());
  }

  private static fromZodAny(zodAny: $ZodAny): TypeNode {
    return factory.createKeywordTypeNode(SyntaxKind.AnyKeyword);
  }

  private static fromZodUnknown(zodUnknown: $ZodUnknown): TypeNode {
    return factory.createKeywordTypeNode(SyntaxKind.UnknownKeyword);
  }

  private static fromZodNever(zodNever: $ZodNever): TypeNode {
    return factory.createKeywordTypeNode(SyntaxKind.NeverKeyword);
  }

  private static fromZodVoid(zodVoid: $ZodVoid): TypeNode {
    return factory.createKeywordTypeNode(SyntaxKind.VoidKeyword);
  }

  private static fromZodArray(zodArray: $ZodArray): TypeNode {
    const innerType = TsTypeNode.fromZod(zodArray._zod.def.element);
    return factory.createArrayTypeNode(innerType);
  }

  private static fromZodObject(zodObject: $ZodObject): TypeNode {
    const entries = Object.entries(zodObject._zod.def.shape);

    const members: TypeElement[] = entries.map(([key, nextZodNode]) => {
      const type = TsTypeNode.fromZod(nextZodNode);

      if (!nextZodNode._zod?.def) {
        console.warn(
          `Zod node for key "${key}" does not have a _zod.def property. This may indicate an issue with the Zod schema.`,
          {
            key,
          }
        );
      }
      const { type: nextZodNodeTypeName } = nextZodNode._zod?.def ?? {};
      const isOptional = nextZodNodeTypeName === "optional";

      const propertySignature = factory.createPropertySignature(
        undefined,
        TsTypeNode.createTsAstPropertyKey(key),
        isOptional ? factory.createToken(SyntaxKind.QuestionToken) : undefined,
        type
      );

      // TODO: add description?
      return propertySignature;
    });
    return factory.createTypeLiteralNode(members);
  }

  private static fromZodUnion(zodUnion: $ZodUnion): TypeNode {
    const options = zodUnion._zod.def.options.map(TsTypeNode.fromZod);
    return factory.createUnionTypeNode(options);
  }

  private static fromZodIntersection(
    zodIntersection: $ZodIntersection
  ): TypeNode {
    const left = TsTypeNode.fromZod(zodIntersection._zod.def.left);
    const right = TsTypeNode.fromZod(zodIntersection._zod.def.right);
    return factory.createIntersectionTypeNode([left, right]);
  }

  private static fromZodTuple(zodTuple: $ZodTuple): TypeNode {
    const elements = zodTuple._zod.def.items.map(TsTypeNode.fromZod);
    return factory.createTupleTypeNode(elements);
  }

  private static fromZodRecord(zodRecord: $ZodRecord): TypeNode {
    const keyType = TsTypeNode.fromZod(zodRecord._zod.def.keyType);
    const valueType = TsTypeNode.fromZod(zodRecord._zod.def.valueType);
    return factory.createTypeReferenceNode(factory.createIdentifier("Record"), [
      keyType,
      valueType,
    ]);
  }

  private static fromZodMap(zodMap: $ZodMap): TypeNode {
    const keyType = TsTypeNode.fromZod(zodMap._zod.def.keyType);
    const valueType = TsTypeNode.fromZod(zodMap._zod.def.valueType);
    return factory.createTypeReferenceNode(factory.createIdentifier("Map"), [
      keyType,
      valueType,
    ]);
  }

  private static fromZodSet(zodSet: $ZodSet): TypeNode {
    const innerType = TsTypeNode.fromZod(zodSet._zod.def.valueType);
    return factory.createTypeReferenceNode(factory.createIdentifier("Set"), [
      innerType,
    ]);
  }

  private static fromZodLiteral(zodLiteral: $ZodLiteral): TypeNode {
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

  private static fromZodEnum(zodEnum: $ZodEnum): TypeNode {
    const entries = Object.entries(zodEnum._zod.def.entries);
    const types = entries.map(([key, value]) => {
      return factory.createLiteralTypeNode(factory.createStringLiteral(key));
    });
    return factory.createUnionTypeNode(types);
  }

  private static fromZodPromise(zodPromise: $ZodPromise): TypeNode {
    const innerType = TsTypeNode.fromZod(zodPromise._zod.def.innerType);
    return factory.createTypeReferenceNode(
      factory.createIdentifier("Promise"),
      [innerType]
    );
  }

  private static fromZodLazy(zodLazy: $ZodLazy): TypeNode {
    // TODO: handle zodLazy
    return factory.createKeywordTypeNode(SyntaxKind.UnknownKeyword);
  }

  private static fromZodOptional(zodOptional: $ZodOptional): TypeNode {
    const innerType = TsTypeNode.fromZod(zodOptional._zod.def.innerType);
    return factory.createUnionTypeNode([
      innerType,
      factory.createKeywordTypeNode(SyntaxKind.UndefinedKeyword),
    ]);
  }

  private static fromZodDefault(zodDefault: $ZodDefault): TypeNode {
    const innerType = TsTypeNode.fromZod(zodDefault._zod.def.innerType);

    const filteredNodes: Node[] = [];
    innerType.forEachChild(node => {
      if (node.kind !== SyntaxKind.UndefinedKeyword) {
        filteredNodes.push(node);
      }
    });

    // TODO: is TsTypeNode correct?
    // @ts-expect-error needed to set children
    innerType.types = filteredNodes;
    return innerType;
  }

  private static fromZodTemplateLiteral(
    zodTemplateLiteral: $ZodTemplateLiteral
  ): TypeNode {
    // TODO: handle zodTemplateLiteral
    return factory.createKeywordTypeNode(SyntaxKind.UnknownKeyword);
  }

  private static fromZodCustom(zodCustom: $ZodCustom): TypeNode {
    // TODO: handle zodCustom
    return factory.createKeywordTypeNode(SyntaxKind.UnknownKeyword);
  }

  private static fromZodTransform(zodTransform: $ZodTransform): TypeNode {
    // TODO: handle zodTransform
    return factory.createKeywordTypeNode(SyntaxKind.UnknownKeyword);
  }

  private static fromZodNonOptional(zodNonOptional: $ZodNonOptional): TypeNode {
    // TODO: handle zodNonOptional
    return factory.createKeywordTypeNode(SyntaxKind.UnknownKeyword);
  }

  private static fromZodReadonly(zodReadonly: $ZodReadonly): TypeNode {
    // TODO: handle zodReadonly
    return factory.createKeywordTypeNode(SyntaxKind.UnknownKeyword);
  }

  private static fromZodNaN(zodNaN: $ZodNaN): TypeNode {
    // TODO: handle zodNaN
    return factory.createKeywordTypeNode(SyntaxKind.UnknownKeyword);
  }

  private static fromZodPipe(zodPipe: $ZodPipe): TypeNode {
    // TODO: handle zodPipe
    return factory.createKeywordTypeNode(SyntaxKind.UnknownKeyword);
  }

  private static fromZodSuccess(zodSuccess: $ZodSuccess): TypeNode {
    // TODO: handle zodSuccess
    return factory.createKeywordTypeNode(SyntaxKind.UnknownKeyword);
  }

  private static fromZodCatch(zodCatch: $ZodCatch): TypeNode {
    // TODO: handle zodCatch
    return factory.createKeywordTypeNode(SyntaxKind.UnknownKeyword);
  }

  private static fromZodFile(zodFile: $ZodFile): TypeNode {
    // TODO: handle zodFile
    return factory.createKeywordTypeNode(SyntaxKind.UnknownKeyword);
  }

  /**
   * Returns a TypeScript AST node representing the property key.
   * If the key is a valid JavaScript identifier, returns an Identifier node.
   * Otherwise, returns a StringLiteral node.
   *
   * @param {string} key - The property key to convert.
   * @returns {Identifier | StringLiteral} The corresponding AST node for the property key.
   */
  private static createTsAstPropertyKey(
    key: string
  ): Identifier | StringLiteral {
    // TODO: is TsTypeNode correct or required anymore?
    if (/^[$A-Z_a-z][\w$]*$/.test(key)) {
      return factory.createIdentifier(key);
    }
    return factory.createStringLiteral(key);
  }
}
