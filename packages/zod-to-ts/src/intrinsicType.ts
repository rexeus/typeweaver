import { factory, SyntaxKind } from "@typescript/typescript6";
import {
  $ZodAny,
  $ZodFile,
  $ZodNaN,
  $ZodNever,
  $ZodSuccess,
  $ZodUnknown,
  $ZodVoid,
} from "zod/v4/core";
import type { TypeNode } from "@typescript/typescript6";
import type { $ZodType } from "zod/v4/core";

export function fromZodIntrinsic(zodType: $ZodType): TypeNode | undefined {
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
  if (zodType instanceof $ZodNaN) {
    return fromZodNaN(zodType);
  }
  if (zodType instanceof $ZodSuccess) {
    return fromZodSuccess(zodType);
  }
  if (zodType instanceof $ZodFile) {
    return fromZodFile(zodType);
  }

  return undefined;
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

function fromZodNaN(_zodNaN: $ZodNaN): TypeNode {
  return factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
}

function fromZodSuccess(_zodSuccess: $ZodSuccess): TypeNode {
  return factory.createKeywordTypeNode(SyntaxKind.BooleanKeyword);
}

function fromZodFile(_zodFile: $ZodFile): TypeNode {
  return factory.createTypeReferenceNode(factory.createIdentifier("File"));
}
