import fs from "node:fs";
import path from "node:path";

type FormatFn = (filename: string, source: string) => Promise<{ code: string }>;

export class Prettier {
  public constructor(private readonly outputDir: string) {}

  public async formatCode(startDir?: string): Promise<void> {
    const format = await this.loadFormatter();
    if (!format) {
      return;
    }

    const targetDir = startDir ?? this.outputDir;
    await this.formatDirectory(targetDir, format);
  }

  private async loadFormatter(): Promise<FormatFn | undefined> {
    try {
      const oxfmt = await import("oxfmt");
      return oxfmt.format;
    } catch {
      console.warn(
        "oxfmt not installed - skipping formatting. Install with: npm install -D oxfmt"
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
        const { code } = await format(filePath, unformatted);
        fs.writeFileSync(filePath, code);
      } else if (content.isDirectory()) {
        await this.formatDirectory(path.join(targetDir, content.name), format);
      }
    }
  }
}
