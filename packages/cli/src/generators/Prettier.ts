import { Generator } from "./Generator";
import prettier from "prettier";
import fs from "fs";
import path from "path";

export class Prettier {
  public static async formatCode(
    startDir: string = Generator.outputDir
  ): Promise<void> {
    const contents = fs.readdirSync(startDir, {
      withFileTypes: true,
    });

    for (const content of contents) {
      if (content.isFile()) {
        const filePath = path.join(startDir, content.name);
        const unformatted = fs.readFileSync(filePath, "utf8");
        const formatted = await prettier.format(unformatted, {
          parser: "typescript",
        });
        fs.writeFileSync(filePath, formatted);
      } else if (content.isDirectory()) {
        await this.formatCode(path.join(startDir, content.name));
      }
    }
  }
}
