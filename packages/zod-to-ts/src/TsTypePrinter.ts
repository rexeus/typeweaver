import {
  createPrinter,
  createSourceFile,
  EmitHint,
  ScriptKind,
  ScriptTarget,
  type TypeNode,
} from "typescript";

export class TsTypePrinter {
  static print(tsType: TypeNode): string {
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
}
