import path from "node:path";
import { FileSystem } from "@effect/platform";
import { SystemError } from "@effect/platform/Error";
import { Effect, Layer } from "effect";

/**
 * Handle for inspecting an `InMemoryFileSystem`'s internal state from tests.
 * The shape is intentionally narrow — it exposes just enough to assert that
 * a write happened or to reset state between tests.
 */
export type InMemoryFsState = {
  readonly readFile: (filePath: string) => string | undefined;
  readonly hasFile: (filePath: string) => boolean;
  readonly listFiles: () => readonly string[];
  readonly listDirectories: () => readonly string[];
  readonly reset: () => void;
};

export type InMemoryFileSystemHandle = {
  readonly layer: Layer.Layer<FileSystem.FileSystem>;
  readonly state: InMemoryFsState;
};

const normalize = (filePath: string): string => path.posix.normalize(filePath);

const parents = (filePath: string): readonly string[] => {
  const segments: string[] = [];
  let current = path.posix.dirname(filePath);
  while (current !== "/" && current !== ".") {
    segments.push(current);
    current = path.posix.dirname(current);
  }
  return segments;
};

const decoder = new TextDecoder();
const encoder = new TextEncoder();

const notFound = (
  method: string,
  filePath: string
): InstanceType<typeof SystemError> =>
  new SystemError({
    reason: "NotFound",
    module: "FileSystem",
    method,
    pathOrDescriptor: filePath,
    description: `In-memory filesystem: path '${filePath}' does not exist`,
  });

/**
 * Test-only `FileSystem.FileSystem` layer backed by an in-memory `Map`.
 *
 * Supports the operations typeweaver's services actually use:
 *   - `makeDirectory`, `writeFileString`, `readFileString`
 *   - `remove`, `exists`, `realPath`
 *   - `makeTempDirectoryScoped`
 *
 * Unsupported methods inherit no-op stubs from `FileSystem.makeNoop`. Use
 * this layer in tests to substitute for `NodeFileSystem.layer`:
 *
 *   const { layer, state } = makeInMemoryFileSystem();
 *   const runtime = ManagedRuntime.make(CliServices.pipe(Layer.provide(layer)));
 *
 * The `state` handle exposes the underlying map for assertions.
 */
export const makeInMemoryFileSystem = (): InMemoryFileSystemHandle => {
  const files = new Map<string, Uint8Array>();
  const directories = new Set<string>(["/"]);
  let tempCounter = 0;

  const ensureParentDirectories = (filePath: string): void => {
    for (const dir of parents(filePath)) {
      directories.add(dir);
    }
  };

  const state: InMemoryFsState = {
    readFile: filePath => {
      const bytes = files.get(normalize(filePath));
      return bytes === undefined ? undefined : decoder.decode(bytes);
    },
    hasFile: filePath => files.has(normalize(filePath)),
    listFiles: () => Array.from(files.keys()).sort(),
    listDirectories: () => Array.from(directories).sort(),
    reset: () => {
      files.clear();
      directories.clear();
      directories.add("/");
      tempCounter = 0;
    },
  };

  const overrides: Partial<FileSystem.FileSystem> = {
    makeDirectory: (dirPath, options) =>
      Effect.sync(() => {
        const normalized = normalize(dirPath);
        if (
          options?.recursive !== true &&
          !directories.has(path.posix.dirname(normalized))
        ) {
          throw notFound("makeDirectory", path.posix.dirname(normalized));
        }
        directories.add(normalized);
        if (options?.recursive === true) {
          for (const dir of parents(normalized)) {
            directories.add(dir);
          }
        }
      }),

    writeFileString: (filePath, content) =>
      Effect.sync(() => {
        const normalized = normalize(filePath);
        files.set(normalized, encoder.encode(content));
        ensureParentDirectories(normalized);
      }),

    writeFile: (filePath, data) =>
      Effect.sync(() => {
        const normalized = normalize(filePath);
        files.set(normalized, Uint8Array.from(data));
        ensureParentDirectories(normalized);
      }),

    readFileString: filePath =>
      Effect.suspend(() => {
        const normalized = normalize(filePath);
        const bytes = files.get(normalized);
        if (bytes === undefined) {
          return Effect.fail(notFound("readFileString", filePath));
        }
        return Effect.succeed(decoder.decode(bytes));
      }),

    readFile: filePath =>
      Effect.suspend(() => {
        const normalized = normalize(filePath);
        const bytes = files.get(normalized);
        if (bytes === undefined) {
          return Effect.fail(notFound("readFile", filePath));
        }
        return Effect.succeed(bytes);
      }),

    exists: filePath =>
      Effect.sync(() => {
        const normalized = normalize(filePath);
        return files.has(normalized) || directories.has(normalized);
      }),

    remove: (filePath, options) =>
      Effect.suspend(() => {
        const normalized = normalize(filePath);
        const isFile = files.has(normalized);
        const isDir = directories.has(normalized);

        if (!isFile && !isDir) {
          return options?.force === true
            ? Effect.void
            : Effect.fail(notFound("remove", filePath));
        }

        if (isFile) {
          files.delete(normalized);
          return Effect.void;
        }

        const prefix = normalized.endsWith("/") ? normalized : `${normalized}/`;
        if (options?.recursive === true) {
          for (const key of Array.from(files.keys())) {
            if (key.startsWith(prefix)) {
              files.delete(key);
            }
          }
          for (const dir of Array.from(directories)) {
            if (dir === normalized || dir.startsWith(prefix)) {
              directories.delete(dir);
            }
          }
          return Effect.void;
        }

        directories.delete(normalized);
        return Effect.void;
      }),

    realPath: filePath => Effect.succeed(normalize(filePath)),

    makeTempDirectoryScoped: options =>
      Effect.acquireRelease(
        Effect.sync(() => {
          tempCounter += 1;
          const prefix = options?.prefix ?? "tmp-";
          const tmpPath = `/.tmp/${prefix}${tempCounter}`;
          directories.add("/.tmp");
          directories.add(tmpPath);
          return tmpPath;
        }),
        tmpPath =>
          Effect.sync(() => {
            const prefix = tmpPath.endsWith("/") ? tmpPath : `${tmpPath}/`;
            for (const key of Array.from(files.keys())) {
              if (key.startsWith(prefix)) {
                files.delete(key);
              }
            }
            for (const dir of Array.from(directories)) {
              if (dir === tmpPath || dir.startsWith(prefix)) {
                directories.delete(dir);
              }
            }
          })
      ),
  };

  return {
    layer: Layer.succeed(FileSystem.FileSystem, FileSystem.makeNoop(overrides)),
    state,
  };
};
