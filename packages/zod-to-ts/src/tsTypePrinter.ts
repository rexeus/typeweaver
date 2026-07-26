import {
  createPrinter,
  createSourceFile,
  EmitHint,
  ScriptKind,
  ScriptTarget,
} from "@typescript/typescript6";
import type { TypeNode } from "@typescript/typescript6";

export function print(tsType: TypeNode): string {
  const sourceFile = createSourceFile(
    "print.ts",
    "",
    ScriptTarget.Latest,
    false,
    ScriptKind.TS
  );
  const printer = createPrinter();
  return printer.printNode(EmitHint.Unspecified, tsType, sourceFile);
}
