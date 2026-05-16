import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Returns the `file://` URL form of an absolute file path. Mirrors the
 * shape that `PluginLoader`'s `toLocalImportSpecifier` produces for
 * absolute paths so tests can compare against it.
 */
export const importPathForFile = (filePath: string): string =>
  pathToFileURL(filePath).href;

/**
 * Real-disk fixture writer for the few `pluginLoader` scenarios that
 * must exercise Node's real `import()` (file-URL resolution and module
 * evaluation failures). The returned API tracks every created temp dir
 * so the test can clean up in one place.
 */
export const createPluginFixtureWorkspace = (): {
  readonly writePluginModule: (source: readonly string[]) => string;
  readonly cleanup: () => void;
} => {
  const tempDirs: string[] = [];

  const createTempDir = (): string => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "typeweaver-plugin-")
    );
    tempDirs.push(tempDir);
    return tempDir;
  };

  const writePluginModule = (source: readonly string[]): string => {
    const pluginPath = path.join(createTempDir(), "plugin.mjs");
    fs.writeFileSync(pluginPath, [...source, ""].join("\n"));
    return pluginPath;
  };

  const cleanup = (): void => {
    for (const tempDir of tempDirs) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  };

  return { writePluginModule, cleanup };
};
