import fs from "fs";
import path from "path";
import { render } from "ejs";
import type { GeneratorContext } from "@rexeus/typeweaver-gen";

export class IndexFileGenerator {
  public constructor(private readonly templateDir: string) {
    //
  }

  public generate(context: GeneratorContext): void {
    const templateFilePath = path.join(this.templateDir, "Index.ejs");
    const template = fs.readFileSync(templateFilePath, "utf8");

    const indexPaths = new Set<string>();
    for (const generatedFile of context.getGeneratedFiles()) {
      indexPaths.add(`./${generatedFile.replace(/\.ts$/, "")}`);
    }

    const content = render(template, {
      indexPaths: Array.from(indexPaths).sort(),
    });

    fs.writeFileSync(path.join(context.outputDir, "index.ts"), content);
  }
}
