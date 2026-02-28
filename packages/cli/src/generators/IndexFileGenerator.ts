import fs from "node:fs";
import path from "node:path";
import type { GeneratorContext } from "@rexeus/typeweaver-gen";
import { render } from "ejs";

export class IndexFileGenerator {
  public constructor(private readonly templateDir: string) {
    //
  }

  public generate(context: GeneratorContext): void {
    const templateFilePath = path.join(this.templateDir, "Index.ejs");
    const template = fs.readFileSync(templateFilePath, "utf8");

    const generatedFiles = context.getGeneratedFiles();
    const groups = new Map<string, Set<string>>();
    const rootFiles = new Set<string>();
    const existingBarrels = new Set<string>();

    for (const file of generatedFiles) {
      const stripped = file.replace(/\.ts$/, "");
      const firstSlash = stripped.indexOf("/");

      if (firstSlash === -1) {
        rootFiles.add(`./${stripped}`);
        continue;
      }

      const firstSegment = stripped.slice(0, firstSlash);

      if (firstSegment === "lib") {
        const secondSlash = stripped.indexOf("/", firstSlash + 1);
        const groupKey =
          secondSlash === -1 ? stripped : stripped.slice(0, secondSlash);

        const entryName = stripped.slice(groupKey.length + 1);

        if (entryName === "index") {
          existingBarrels.add(groupKey);
        } else {
          if (!groups.has(groupKey)) {
            groups.set(groupKey, new Set());
          }
          groups.get(groupKey)!.add(`./${entryName}`);
        }
      } else {
        const entryName = stripped.slice(firstSlash + 1);

        if (entryName === "index") {
          existingBarrels.add(firstSegment);
        } else {
          if (!groups.has(firstSegment)) {
            groups.set(firstSegment, new Set());
          }
          groups.get(firstSegment)!.add(`./${entryName}`);
        }
      }
    }

    for (const [groupKey, entries] of groups) {
      if (existingBarrels.has(groupKey)) {
        continue;
      }

      const domainBarrelContent = render(template, {
        indexPaths: Array.from(entries).sort(),
      });

      const domainIndexPath = path.join(
        context.outputDir,
        groupKey,
        "index.ts"
      );
      fs.mkdirSync(path.dirname(domainIndexPath), { recursive: true });
      fs.writeFileSync(domainIndexPath, domainBarrelContent);
    }

    const rootIndexPaths = new Set<string>(rootFiles);
    for (const groupKey of groups.keys()) {
      rootIndexPaths.add(`./${groupKey}`);
    }
    for (const barrelKey of existingBarrels) {
      rootIndexPaths.add(`./${barrelKey}`);
    }

    const rootContent = render(template, {
      indexPaths: Array.from(rootIndexPaths).sort(),
    });

    fs.writeFileSync(path.join(context.outputDir, "index.ts"), rootContent);
  }
}
