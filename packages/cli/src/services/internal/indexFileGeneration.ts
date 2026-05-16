/**
 * Pure barrel-computation logic for typeweaver index files.
 *
 * Promotes the per-domain `index.ts` and root `index.ts` from raw
 * `fs.writeFileSync` calls to writes that flow through the supplied
 * `writeFile` callback — so every generated file follows the same
 * atomic-replace + tracking path as plugin-written files. The
 * accompanying `IndexFileGenerator` service supplies the production
 * `writeFile` and `renderTemplate` implementations; tests supply
 * lightweight fakes.
 */
export type IndexFileGenerationContext = {
  readonly generatedFiles: readonly string[];
  readonly writeFile: (relativePath: string, content: string) => void;
  readonly renderTemplate: (data: unknown) => string;
};

export function generateIndexFiles(context: IndexFileGenerationContext): void {
  const groups = new Map<string, Set<string>>();
  const rootFiles = new Set<string>();
  const existingBarrels = new Set<string>();

  for (const file of context.generatedFiles) {
    const normalizedFile = file.replace(/\\/g, "/");

    if (!isBarrelEligibleTypeScriptSourceFile(normalizedFile)) {
      continue;
    }

    const withJsExt = normalizedFile.replace(/\.ts$/, ".js");
    const stripped = normalizedFile.replace(/\.ts$/, "");
    const firstSlash = stripped.indexOf("/");

    if (stripped === "index") {
      continue;
    }

    if (firstSlash === -1) {
      rootFiles.add(`./${withJsExt}`);
      continue;
    }

    const firstSegment = stripped.slice(0, firstSlash);

    if (stripped === "lib/index") {
      existingBarrels.add("lib");
      continue;
    }

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
        groups.get(groupKey)!.add(`./${entryName}.js`);
      }
    } else {
      const entryName = stripped.slice(firstSlash + 1);

      if (entryName === "index") {
        existingBarrels.add(firstSegment);
      } else {
        if (!groups.has(firstSegment)) {
          groups.set(firstSegment, new Set());
        }
        groups.get(firstSegment)!.add(`./${entryName}.js`);
      }
    }
  }

  const sortedGroupKeys = Array.from(groups.keys()).sort();
  for (const groupKey of sortedGroupKeys) {
    if (existingBarrels.has(groupKey)) {
      continue;
    }

    const entries = groups.get(groupKey)!;
    const domainBarrelContent = context.renderTemplate({
      indexPaths: Array.from(entries).sort(),
    });

    context.writeFile(`${groupKey}/index.ts`, domainBarrelContent);
  }

  const rootIndexPaths = new Set<string>(rootFiles);
  for (const groupKey of sortedGroupKeys) {
    rootIndexPaths.add(`./${groupKey}/index.js`);
  }
  for (const barrelKey of Array.from(existingBarrels).sort()) {
    rootIndexPaths.add(`./${barrelKey}/index.js`);
  }

  const rootContent = context.renderTemplate({
    indexPaths: Array.from(rootIndexPaths).sort(),
  });

  context.writeFile("index.ts", rootContent);
}

function isBarrelEligibleTypeScriptSourceFile(filePath: string): boolean {
  return filePath.endsWith(".ts") && !filePath.endsWith(".d.ts");
}
