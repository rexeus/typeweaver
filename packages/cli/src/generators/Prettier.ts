import prettier from "prettier";
import fs from "fs";
import path from "path";

export class Prettier {
  constructor(private readonly outputDir: string) {
    //
  }

  public async formatCode(startDir?: string): Promise<void> {
    const targetDir = startDir ?? this.outputDir;
    const contents = fs.readdirSync(targetDir, {
      withFileTypes: true,
    });

    for (const content of contents) {
      if (content.isFile()) {
        const filePath = path.join(targetDir, content.name);
        const unformatted = fs.readFileSync(filePath, "utf8");
        const formatted = await prettier.format(unformatted, {
          parser: "typescript",
        });
        fs.writeFileSync(filePath, formatted);
      } else if (content.isDirectory()) {
        await this.formatCode(path.join(targetDir, content.name));
      }
    }
  }
}
