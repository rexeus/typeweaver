import fs from "node:fs";
import path from "node:path";
import { resolveSafeGeneratedFilePath } from "../helpers/pathSafety.js";
import type { GeneratorContext } from "./contextTypes.js";

/**
 * Copy a plugin's runtime library files from its package's `lib` directory
 * into the generated output's `lib/{namespace}/` subtree. No-op if the
 * source directory does not exist. When the copied tree includes a
 * top-level `index.ts`, registers it as a generated file so the
 * index-file generator picks it up.
 *
 * Stays sync (and on `node:fs` rather than the Effect-native FileSystem
 * service) because plugins keep `R = never` on every lifecycle stage —
 * the platform-agnostic `gen` package would otherwise need to depend on
 * `@effect/platform-node` to provide `FileSystem`. The directory copy is
 * a contained, deterministic operation; consumers that need substitution
 * can replace the entire plugin (e.g. via a test fake) rather than
 * shimming the copy step.
 */
export const copyPluginLibFiles = (params: {
  readonly context: GeneratorContext;
  readonly libSourceDir: string;
  readonly libNamespace: string;
}): void => {
  if (!fs.existsSync(params.libSourceDir)) return;

  // Funnel the destination through the same path-safety guard used by
  // `writeFile` / `addGeneratedFile` so a malicious or typo'd plugin name
  // (`name: "../escape"`) cannot scribble outside `outputDir`. The path is
  // built by plain concatenation — `path.posix.join` would silently
  // normalize away the very `..` segments the guard is meant to catch.
  // The guard throws `UnsafeGeneratedPathError`, which the surrounding
  // `Effect.try` in `definePluginWithLibCopy` translates to
  // `PluginExecutionError`.
  const requestedLibPath = `lib/${params.libNamespace}/.cp`;
  const safeLibDir = resolveSafeGeneratedFilePath(
    params.context.outputDir,
    requestedLibPath
  );
  // The `.cp` suffix is a synthetic leaf so the guard validates a
  // file-shaped path; the actual destination is the parent directory.
  const libDir = path.dirname(safeLibDir.fullPath);

  fs.cpSync(params.libSourceDir, libDir, { recursive: true });

  if (fs.existsSync(path.join(libDir, "index.ts"))) {
    params.context.addGeneratedFile(
      path.join("lib", params.libNamespace, "index.ts")
    );
  }
};
