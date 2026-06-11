/**
 * Pure barrel-computation logic for typeweaver index files.
 *
 * `planIndexFiles` derives the full set of barrel writes (per-domain
 * `index.ts` plus the root `index.ts`) from the generated-file list — no
 * I/O, no rendering. The `IndexFileGenerator` service renders each planned
 * barrel through the Effect-native `TemplateRenderer` and routes the write
 * through the run's `writeFile` callback, so every barrel follows the same
 * atomic-replace + tracking path as plugin-written files.
 *
 * `generateIndexFiles` is the sync convenience wrapper over the plan,
 * preserved for callers (and tests) that supply sync `renderTemplate` /
 * `writeFile` callbacks.
 */
export type IndexFileTemplateData = {
  readonly indexPaths: readonly string[];
};

export type PlannedIndexFile = {
  readonly path: string;
  readonly data: IndexFileTemplateData;
};

export type IndexFileGenerationContext = {
  readonly generatedFiles: readonly string[];
  readonly writeFile: (relativePath: string, content: string) => void;
  readonly renderTemplate: (data: IndexFileTemplateData) => string;
};

export function planIndexFiles(
  generatedFiles: readonly string[]
): readonly PlannedIndexFile[] {
  const groups = new Map<string, Set<string>>();
  const rootFiles = new Set<string>();
  const existingBarrels = new Set<string>();

  for (const file of generatedFiles) {
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

  const planned: PlannedIndexFile[] = [];

  const sortedGroupKeys = Array.from(groups.keys()).sort();
  for (const groupKey of sortedGroupKeys) {
    if (existingBarrels.has(groupKey)) {
      continue;
    }

    const entries = groups.get(groupKey)!;
    planned.push({
      path: `${groupKey}/index.ts`,
      data: { indexPaths: Array.from(entries).sort() },
    });
  }

  const rootIndexPaths = new Set<string>(rootFiles);
  for (const groupKey of sortedGroupKeys) {
    rootIndexPaths.add(`./${groupKey}/index.js`);
  }
  for (const barrelKey of Array.from(existingBarrels).sort()) {
    rootIndexPaths.add(`./${barrelKey}/index.js`);
  }

  planned.push({
    path: "index.ts",
    data: { indexPaths: Array.from(rootIndexPaths).sort() },
  });

  return planned;
}

export function generateIndexFiles(context: IndexFileGenerationContext): void {
  for (const planned of planIndexFiles(context.generatedFiles)) {
    context.writeFile(planned.path, context.renderTemplate(planned.data));
  }
}

function isBarrelEligibleTypeScriptSourceFile(filePath: string): boolean {
  return filePath.endsWith(".ts") && !filePath.endsWith(".d.ts");
}
