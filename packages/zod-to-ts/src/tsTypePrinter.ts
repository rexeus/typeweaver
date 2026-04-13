import {
  createPrinter,
  createSourceFile,
  EmitHint,
  ScriptKind,
  ScriptTarget,
} from "typescript";
import type { TypeNode } from "typescript";

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
