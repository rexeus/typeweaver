import fs from "node:fs";
import path from "node:path";

const tempDirs: string[] = [];

export const removeTempDirs = (): void => {
  for (const tempDir of tempDirs) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
};

export const createTempWorkspace = (label: string): string => {
  const tempDir = fs.mkdtempSync(
    path.join(process.cwd(), `.typeweaver-lifecycle-${label}-`)
  );
  tempDirs.push(tempDir);
  return tempDir;
};

/**
 * Writes `alpha` and `beta` (depends on `alpha`) plugins that append each
 * lifecycle stage to `lifecycle-events.log`; returns their module paths.
 */
export const writeRecordingPlugins = (workspace: string): readonly string[] => {
  const eventsFile = path.join(workspace, "lifecycle-events.log");
  fs.writeFileSync(eventsFile, "");

  const pluginFor = (name: string): string => {
    const pluginFile = path.join(workspace, "plugins", `${name}.mjs`);
    fs.mkdirSync(path.dirname(pluginFile), { recursive: true });
    fs.writeFileSync(
      pluginFile,
      [
        'import fs from "node:fs";',
        'import { Effect } from "effect";',
        "",
        `const eventsFile = ${JSON.stringify(eventsFile)};`,
        `const pluginName = ${JSON.stringify(name)};`,
        "",
        "const record = stage =>",
        "  Effect.sync(() => {",
        "    fs.appendFileSync(eventsFile, `${stage}:${pluginName}\\n`);",
        "  });",
        "",
        `export const ${name}Plugin = {`,
        "  name: pluginName,",
        ...(name === "beta" ? ['  depends: ["alpha"],'] : []),
        '  initialize: _ctx => record("initialize"),',
        "  collectResources: spec =>",
        "    Effect.gen(function* () {",
        '      yield* record("collectResources");',
        "      return spec;",
        "    }),",
        '  generate: _ctx => record("generate"),',
        '  finalize: _ctx => record("finalize"),',
        "};",
        "",
      ].join("\n")
    );
    return pluginFile;
  };

  return [pluginFor("alpha"), pluginFor("beta")];
};

export const readEvents = (workspace: string): readonly string[] => {
  const file = path.join(workspace, "lifecycle-events.log");
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter(line => line.length > 0);
};
