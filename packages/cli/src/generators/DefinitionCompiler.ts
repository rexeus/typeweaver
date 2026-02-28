import fs from "node:fs";
import path from "node:path";
import { transformSync } from "oxc-transform";

/**
 * Compiles TypeScript definition files to JavaScript + declaration stubs.
 *
 * Definition files contain Zod schemas that cause tsc to exhaust memory
 * when type-checking due to Zod v4's deeply recursive type inference.
 * By pre-compiling definitions to .js + .d.ts, tsc only sees lightweight
 * type stubs (everything typed as `any`) while runtime behavior is preserved.
 */
export class DefinitionCompiler {
  /**
   * Compiles all .ts definition files in-place to .js + .d.ts stubs.
   * The original .ts files are removed after compilation.
   */
  public compileInPlace(definitionDir: string): void {
    this.processDirectory(definitionDir);
  }

  private processDirectory(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        this.processDirectory(fullPath);
        continue;
      }

      if (
        entry.isFile() &&
        entry.name.endsWith(".ts") &&
        !entry.name.endsWith(".d.ts")
      ) {
        this.compileFile(fullPath, dir, entry.name);
      }
    }
  }

  private compileFile(srcPath: string, dir: string, fileName: string): void {
    const source = fs.readFileSync(srcPath, "utf-8");
    const baseName = fileName.replace(/\.ts$/, "");

    const jsCode = this.transpileToJs(fileName, source);
    const dtsCode = this.generateDtsStub(source);

    fs.writeFileSync(path.join(dir, `${baseName}.js`), jsCode);
    fs.writeFileSync(path.join(dir, `${baseName}.d.ts`), dtsCode);
    fs.unlinkSync(srcPath);
  }

  private transpileToJs(fileName: string, source: string): string {
    const result = transformSync(fileName, source, {
      lang: "ts",
      sourceType: "module",
    });
    return result.code;
  }

  /**
   * Generates a minimal .d.ts stub from TypeScript source.
   * All value exports are typed as `any` to avoid pulling in Zod's type system.
   * Re-exports are preserved so barrel files chain correctly.
   */
  private generateDtsStub(source: string): string {
    const lines: string[] = [];
    let hasDefaultExport = false;

    for (const line of source.split("\n")) {
      const trimmed = line.trim();

      if (trimmed.startsWith("export {") || trimmed.startsWith("export *")) {
        lines.push(trimmed);
        continue;
      }

      if (trimmed.startsWith("export default") && !hasDefaultExport) {
        lines.push("declare const _default: any;");
        lines.push("export default _default;");
        hasDefaultExport = true;
        continue;
      }

      const constMatch = trimmed.match(/^export\s+(?:const|let|var)\s+(\w+)/);
      if (constMatch) {
        lines.push(`export declare const ${constMatch[1]}: any;`);
        continue;
      }

      const funcMatch = trimmed.match(/^export\s+function\s+(\w+)/);
      if (funcMatch) {
        lines.push(
          `export declare function ${funcMatch[1]}(...args: any[]): any;`
        );
        continue;
      }
    }

    return lines.join("\n") + "\n";
  }
}
