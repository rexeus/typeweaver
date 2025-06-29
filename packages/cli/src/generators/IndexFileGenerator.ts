import path from "path";
import { Generator } from "./Generator";
import fs from "fs";
import ejs from "ejs";
import type { GeneratorContext } from "@rexeus/typeweaver-gen";

export class IndexFileGenerator {
  public static generate(context: GeneratorContext): void {
    const templateFilePath = path.join(Generator.templateDir, "Index.ejs");
    const template = fs.readFileSync(templateFilePath, "utf8");

    const indexPaths: Set<string> = new Set();
    for (const generatedFile of context.getGeneratedFiles()) {
      indexPaths.add(`./${generatedFile.replace(/\.ts$/, "")}`);
    }

    const content = ejs.render(template, {
      indexPaths: Array.from(indexPaths).sort(),
    });

    fs.writeFileSync(path.join(Generator.outputDir, "index.ts"), content);
  }
}
