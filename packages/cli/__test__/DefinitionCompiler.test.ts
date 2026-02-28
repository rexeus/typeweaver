import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DefinitionCompiler } from "../src/generators/DefinitionCompiler.js";
import { DefinitionCompilationError } from "../src/generators/errors/DefinitionCompilationError.js";

const compiler = new DefinitionCompiler();

// Access private methods for unit testing
const transpileToJs = (fileName: string, source: string): string =>
  (compiler as any).transpileToJs(fileName, source);

const generateDtsStub = (source: string): string =>
  (compiler as any).generateDtsStub(source);

describe("DefinitionCompiler", () => {
  describe("transpileToJs", () => {
    it("strips type annotations from valid TypeScript", () => {
      const result = transpileToJs(
        "test.ts",
        'export const foo: string = "bar";'
      );
      expect(result).toContain("export const foo =");
      expect(result).not.toContain(": string");
    });

    it("throws DefinitionCompilationError for invalid syntax", () => {
      expect(() => transpileToJs("broken.ts", "export const = ;")).toThrow(
        DefinitionCompilationError
      );
    });
  });

  describe("generateDtsStub", () => {
    it("converts export const to declare const with any type", () => {
      const result = generateDtsStub(
        'export const todoSchema = z.object({ name: z.string() });'
      );
      expect(result).toBe("export declare const todoSchema: any;\n");
    });

    it("converts export default to declare const _default", () => {
      const result = generateDtsStub(
        "export default new HttpOperationDefinition({});"
      );
      expect(result).toBe(
        "declare const _default: any;\nexport default _default;\n"
      );
    });

    it("converts export function to declare function", () => {
      const result = generateDtsStub(
        "export function listResponseSchema(schema) { return schema; }"
      );
      expect(result).toBe(
        "export declare function listResponseSchema(...args: any[]): any;\n"
      );
    });

    it("preserves export * re-exports", () => {
      const result = generateDtsStub(
        'export * from "./schemas/metadataSchema";'
      );
      expect(result).toBe('export * from "./schemas/metadataSchema";\n');
    });

    it("preserves export { default as } re-exports", () => {
      const result = generateDtsStub(
        'export { default as FooDefinition } from "./Foo";'
      );
      expect(result).toBe(
        'export { default as FooDefinition } from "./Foo";\n'
      );
    });

    it("ignores non-export lines", () => {
      const source = [
        'import { z } from "zod";',
        "",
        "// A comment",
        'const internal = "hidden";',
        'export const visible = "shown";',
      ].join("\n");
      const result = generateDtsStub(source);
      expect(result).toBe("export declare const visible: any;\n");
    });

    it("only includes the first default export", () => {
      const source = [
        "export default firstThing;",
        "export default secondThing;",
      ].join("\n");
      const result = generateDtsStub(source);
      expect(result).toBe(
        "declare const _default: any;\nexport default _default;\n"
      );
    });
  });

  describe("compileInPlace", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "defcomp-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("compiles .ts to .js + .d.ts and removes original", () => {
      fs.writeFileSync(
        path.join(tmpDir, "foo.ts"),
        'export const foo: string = "bar";'
      );

      compiler.compileInPlace(tmpDir);

      expect(fs.existsSync(path.join(tmpDir, "foo.ts"))).toBe(false);
      expect(fs.existsSync(path.join(tmpDir, "foo.js"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, "foo.d.ts"))).toBe(true);
    });

    it("skips existing .d.ts files", () => {
      const dtsPath = path.join(tmpDir, "types.d.ts");
      fs.writeFileSync(dtsPath, "export declare const x: number;");

      compiler.compileInPlace(tmpDir);

      expect(fs.existsSync(dtsPath)).toBe(true);
      expect(fs.readFileSync(dtsPath, "utf-8")).toBe(
        "export declare const x: number;"
      );
    });

    it("processes nested directories recursively", () => {
      const subDir = path.join(tmpDir, "nested");
      fs.mkdirSync(subDir);
      fs.writeFileSync(
        path.join(subDir, "deep.ts"),
        'export const deep: boolean = true;'
      );

      compiler.compileInPlace(tmpDir);

      expect(fs.existsSync(path.join(subDir, "deep.ts"))).toBe(false);
      expect(fs.existsSync(path.join(subDir, "deep.js"))).toBe(true);
      expect(fs.existsSync(path.join(subDir, "deep.d.ts"))).toBe(true);
    });

    it("throws DefinitionCompilationError for invalid files", () => {
      fs.writeFileSync(
        path.join(tmpDir, "broken.ts"),
        "export const = ;"
      );

      expect(() => compiler.compileInPlace(tmpDir)).toThrow(
        DefinitionCompilationError
      );
    });

    it("continues processing after errors and reports all failures", () => {
      fs.writeFileSync(
        path.join(tmpDir, "a_valid.ts"),
        'export const a: string = "ok";'
      );
      fs.writeFileSync(
        path.join(tmpDir, "b_broken.ts"),
        "export const = ;"
      );
      fs.writeFileSync(
        path.join(tmpDir, "c_valid.ts"),
        'export const c: number = 42;'
      );

      try {
        compiler.compileInPlace(tmpDir);
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(DefinitionCompilationError);
        const compError = error as DefinitionCompilationError;
        expect(compError.details).toContain("1 file(s) failed to compile");
      }

      // Valid files should still have been compiled
      expect(fs.existsSync(path.join(tmpDir, "a_valid.js"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, "c_valid.js"))).toBe(true);
    });
  });
});
