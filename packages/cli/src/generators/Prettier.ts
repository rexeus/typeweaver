import fs from "node:fs";
import path from "node:path";

type FormatFn = typeof import("prettier").format;

export class Prettier {
  public constructor(private readonly outputDir: string) {}

  public async formatCode(startDir?: string): Promise<void> {
    const format = await this.loadPrettier();
    if (!format) {
      return;
    }

    const targetDir = startDir ?? this.outputDir;
    await this.formatDirectory(targetDir, format);
  }

  private async loadPrettier(): Promise<FormatFn | undefined> {
    try {
      const prettier = await import("prettier");
      return prettier.format;
    } catch {
      console.warn(
        "Prettier not installed - skipping formatting. Install with: npm install -D prettier"
      );
      return undefined;
    }
  }

  private async formatDirectory(
    targetDir: string,
    format: FormatFn
  ): Promise<void> {
    const contents = fs.readdirSync(targetDir, { withFileTypes: true });

    for (const content of contents) {
      if (content.isFile()) {
        const filePath = path.join(targetDir, content.name);
        const unformatted = fs.readFileSync(filePath, "utf8");
        const formatted = await format(unformatted, { parser: "typescript" });
        fs.writeFileSync(filePath, formatted);
      } else if (content.isDirectory()) {
        await this.formatDirectory(path.join(targetDir, content.name), format);
      }
    }
  }
}
