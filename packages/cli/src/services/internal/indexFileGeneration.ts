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

type IndexFileCandidate =
  | { readonly _tag: "Ignored" }
  | { readonly _tag: "RootFile"; readonly path: string }
  | { readonly _tag: "ExistingBarrel"; readonly group: string }
  | {
      readonly _tag: "GroupEntry";
      readonly group: string;
      readonly path: string;
    };

type IndexFileState = {
  readonly groups: Map<string, Set<string>>;
  readonly rootFiles: Set<string>;
  readonly existingBarrels: Set<string>;
};

function classifyIndexFile(file: string): IndexFileCandidate {
  const normalizedFile = file.replace(/\\/g, "/");
  if (!isBarrelEligibleTypeScriptSourceFile(normalizedFile)) {
    return { _tag: "Ignored" };
  }

  const withJsExt = normalizedFile.replace(/\.ts$/, ".js");
  const stripped = normalizedFile.replace(/\.ts$/, "");
  if (stripped === "index") {
    return { _tag: "Ignored" };
  }

  const firstSlash = stripped.indexOf("/");
  if (firstSlash === -1) {
    return { _tag: "RootFile", path: `./${withJsExt}` };
  }

  const firstSegment = stripped.slice(0, firstSlash);
  if (stripped === "lib/index") {
    return { _tag: "ExistingBarrel", group: "lib" };
  }

  const secondSlash = stripped.indexOf("/", firstSlash + 1);
  const group =
    firstSegment === "lib"
      ? secondSlash === -1
        ? stripped
        : stripped.slice(0, secondSlash)
      : firstSegment;
  const entryName = stripped.slice(group.length + 1);
  return entryName === "index"
    ? { _tag: "ExistingBarrel", group }
    : { _tag: "GroupEntry", group, path: `./${entryName}.js` };
}

function addGroupEntry(
  groups: Map<string, Set<string>>,
  group: string,
  entryPath: string
): void {
  const entries = groups.get(group) ?? new Set<string>();
  entries.add(entryPath);
  groups.set(group, entries);
}

function recordIndexFileCandidate(
  state: IndexFileState,
  candidate: IndexFileCandidate
): void {
  switch (candidate._tag) {
    case "Ignored":
      return;
    case "RootFile":
      state.rootFiles.add(candidate.path);
      return;
    case "ExistingBarrel":
      state.existingBarrels.add(candidate.group);
      return;
    case "GroupEntry":
      addGroupEntry(state.groups, candidate.group, candidate.path);
  }
}

function planGroupIndexes(
  groups: Map<string, Set<string>>,
  existingBarrels: ReadonlySet<string>
): readonly PlannedIndexFile[] {
  return Array.from(groups.keys())
    .sort()
    .filter(group => !existingBarrels.has(group))
    .map(group => ({
      path: `${group}/index.ts`,
      data: { indexPaths: Array.from(groups.get(group)!).sort() },
    }));
}

function planRootIndex(
  groups: Map<string, Set<string>>,
  rootFiles: ReadonlySet<string>,
  existingBarrels: ReadonlySet<string>
): PlannedIndexFile {
  const groupedIndexes = [...groups.keys(), ...existingBarrels]
    .sort()
    .map(group => `./${group}/index.js`);
  return {
    path: "index.ts",
    data: {
      indexPaths: Array.from(new Set([...rootFiles, ...groupedIndexes])).sort(),
    },
  };
}

export function planIndexFiles(
  generatedFiles: readonly string[]
): readonly PlannedIndexFile[] {
  const state: IndexFileState = {
    groups: new Map(),
    rootFiles: new Set(),
    existingBarrels: new Set(),
  };

  for (const file of generatedFiles) {
    recordIndexFileCandidate(state, classifyIndexFile(file));
  }

  return [
    ...planGroupIndexes(state.groups, state.existingBarrels),
    planRootIndex(state.groups, state.rootFiles, state.existingBarrels),
  ];
}

export function generateIndexFiles(context: IndexFileGenerationContext): void {
  for (const planned of planIndexFiles(context.generatedFiles)) {
    context.writeFile(planned.path, context.renderTemplate(planned.data));
  }
}

function isBarrelEligibleTypeScriptSourceFile(filePath: string): boolean {
  return filePath.endsWith(".ts") && !filePath.endsWith(".d.ts");
}
