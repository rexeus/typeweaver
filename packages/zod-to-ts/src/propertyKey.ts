import {
  factory,
  isIdentifierPart,
  isIdentifierStart,
  ScriptTarget,
} from "@typescript/typescript6";
import type { Identifier, StringLiteral } from "@typescript/typescript6";

const RESERVED_IDENTIFIER_NAMES = new Set([
  "abstract",
  "accessor",
  "any",
  "as",
  "asserts",
  "async",
  "await",
  "bigint",
  "boolean",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "constructor",
  "continue",
  "debugger",
  "declare",
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
  "from",
  "function",
  "get",
  "global",
  "if",
  "implements",
  "import",
  "in",
  "infer",
  "instanceof",
  "interface",
  "intrinsic",
  "is",
  "keyof",
  "let",
  "module",
  "namespace",
  "never",
  "new",
  "null",
  "number",
  "object",
  "of",
  "out",
  "override",
  "package",
  "private",
  "protected",
  "public",
  "readonly",
  "require",
  "return",
  "satisfies",
  "set",
  "static",
  "string",
  "super",
  "switch",
  "symbol",
  "this",
  "throw",
  "true",
  "try",
  "type",
  "typeof",
  "undefined",
  "unique",
  "unknown",
  "using",
  "var",
  "void",
  "while",
  "with",
  "yield",
]);

export function createTsAstPropertyKey(
  key: string
): Identifier | StringLiteral {
  if (isSafePropertyIdentifier(key)) {
    return factory.createIdentifier(key);
  }
  return factory.createStringLiteral(key);
}

function isSafePropertyIdentifier(key: string): boolean {
  return isIdentifierName(key) && !RESERVED_IDENTIFIER_NAMES.has(key);
}

function isIdentifierName(value: string): boolean {
  const [firstCharacter] = value;

  if (!firstCharacter) {
    return false;
  }

  return (
    isIdentifierStart(
      firstCharacter.codePointAt(0) ?? 0,
      ScriptTarget.Latest
    ) &&
    Array.from(value.slice(firstCharacter.length)).every(character =>
      isIdentifierPart(character.codePointAt(0) ?? 0, ScriptTarget.Latest)
    )
  );
}
