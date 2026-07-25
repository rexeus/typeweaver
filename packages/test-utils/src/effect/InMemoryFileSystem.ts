import path from "node:path";
import { FileSystem } from "@effect/platform";
import { SystemError } from "@effect/platform/Error";
import { Effect, Layer, Option } from "effect";

/**
 * Handle for inspecting an `InMemoryFileSystem`'s internal state from tests.
 * The shape is intentionally narrow — it exposes just enough to assert that
 * a write happened or to reset state between tests.
 */
export type InMemoryFsState = {
  readonly readFile: (filePath: string) => string | undefined;
  readonly hasFile: (filePath: string) => boolean;
  readonly fileMode: (filePath: string) => number | undefined;
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
 *   - `rename`, `stat`, `chmod` (atomic-replace write path)
 *   - `makeTempDirectoryScoped` (honors the `directory` option)
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
  const fileModes = new Map<string, number>();
  const DEFAULT_FILE_MODE = 0o644;
  let tempCounter = 0;

  const ensureParentDirectories = (filePath: string): void => {
    for (const dir of parents(filePath)) {
      directories.add(dir);
    }
  };

  const parentExists = (filePath: string): boolean =>
    directories.has(path.posix.dirname(filePath));

  const state: InMemoryFsState = {
    readFile: filePath => {
      const bytes = files.get(normalize(filePath));
      return bytes === undefined ? undefined : decoder.decode(bytes);
    },
    hasFile: filePath => files.has(normalize(filePath)),
    fileMode: filePath =>
      files.has(normalize(filePath))
        ? (fileModes.get(normalize(filePath)) ?? DEFAULT_FILE_MODE)
        : undefined,
    listFiles: () => Array.from(files.keys()).sort(),
    listDirectories: () => Array.from(directories).sort(),
    reset: () => {
      files.clear();
      directories.clear();
      fileModes.clear();
      directories.add("/");
      tempCounter = 0;
    },
  };

  const overrides: Partial<FileSystem.FileSystem> = {
    makeDirectory: (dirPath, options) =>
      Effect.suspend(() => {
        const normalized = normalize(dirPath);
        if (options?.recursive !== true && !parentExists(normalized)) {
          return Effect.fail(
            notFound("makeDirectory", path.posix.dirname(normalized))
          );
        }
        directories.add(normalized);
        if (options?.recursive === true) {
          for (const dir of parents(normalized)) {
            directories.add(dir);
          }
        }
        return Effect.void;
      }),

    writeFileString: (filePath, content) =>
      Effect.suspend(() => {
        const normalized = normalize(filePath);
        if (!parentExists(normalized)) {
          return Effect.fail(notFound("writeFileString", filePath));
        }
        files.set(normalized, encoder.encode(content));
        return Effect.void;
      }),

    writeFile: (filePath, data) =>
      Effect.suspend(() => {
        const normalized = normalize(filePath);
        if (!parentExists(normalized)) {
          return Effect.fail(notFound("writeFile", filePath));
        }
        files.set(normalized, Uint8Array.from(data));
        return Effect.void;
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

    readDirectory: dirPath =>
      Effect.suspend(() => {
        const normalized = normalize(dirPath);
        if (!directories.has(normalized)) {
          return Effect.fail(notFound("readDirectory", dirPath));
        }

        const entries = new Set<string>();
        for (const filePath of files.keys()) {
          if (path.posix.dirname(filePath) === normalized) {
            entries.add(path.posix.basename(filePath));
          }
        }
        for (const directory of directories) {
          if (
            directory !== normalized &&
            path.posix.dirname(directory) === normalized
          ) {
            entries.add(path.posix.basename(directory));
          }
        }
        return Effect.succeed(Array.from(entries).sort());
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
          fileModes.delete(normalized);
          return Effect.void;
        }

        const prefix = normalized.endsWith("/") ? normalized : `${normalized}/`;
        if (options?.recursive === true) {
          for (const key of Array.from(files.keys())) {
            if (key.startsWith(prefix)) {
              files.delete(key);
              fileModes.delete(key);
            }
          }
          for (const dir of Array.from(directories)) {
            if (dir === normalized || dir.startsWith(prefix)) {
              directories.delete(dir);
            }
          }
          return Effect.void;
        }

        // Non-recursive removal of a directory: match Node's `rm` semantics
        // and refuse when the directory still contains files or child dirs.
        const hasChildren =
          Array.from(files.keys()).some(key => key.startsWith(prefix)) ||
          Array.from(directories).some(
            dir => dir !== normalized && dir.startsWith(prefix)
          );

        if (hasChildren) {
          return Effect.fail(
            new SystemError({
              reason: "AlreadyExists",
              module: "FileSystem",
              method: "remove",
              pathOrDescriptor: filePath,
              description: `In-memory filesystem: directory '${filePath}' is not empty; pass { recursive: true } to remove it`,
            })
          );
        }

        directories.delete(normalized);
        return Effect.void;
      }),

    realPath: filePath =>
      Effect.suspend(() => {
        const normalized = normalize(filePath);
        if (!files.has(normalized) && !directories.has(normalized)) {
          return Effect.fail(notFound("realPath", filePath));
        }
        return Effect.succeed(normalized);
      }),

    rename: (oldPath, newPath) =>
      Effect.suspend(() => {
        const normalizedOld = normalize(oldPath);
        const normalizedNew = normalize(newPath);
        const bytes = files.get(normalizedOld);
        if (bytes === undefined) {
          return Effect.fail(notFound("rename", oldPath));
        }
        if (!parentExists(normalizedNew)) {
          return Effect.fail(
            notFound("rename", path.posix.dirname(normalizedNew))
          );
        }
        files.delete(normalizedOld);
        files.set(normalizedNew, bytes);
        const mode = fileModes.get(normalizedOld);
        fileModes.delete(normalizedOld);
        if (mode !== undefined) {
          fileModes.set(normalizedNew, mode);
        }
        return Effect.void;
      }),

    chmod: (filePath, mode) =>
      Effect.suspend(() => {
        const normalized = normalize(filePath);
        if (!files.has(normalized) && !directories.has(normalized)) {
          return Effect.fail(notFound("chmod", filePath));
        }
        fileModes.set(normalized, mode);
        return Effect.void;
      }),

    stat: filePath =>
      Effect.suspend(() => {
        const normalized = normalize(filePath);
        const isFile = files.has(normalized);
        const isDirectory = directories.has(normalized);
        if (!isFile && !isDirectory) {
          return Effect.fail(notFound("stat", filePath));
        }
        const size = isFile
          ? BigInt(files.get(normalized)?.length ?? 0)
          : BigInt(0);
        return Effect.succeed({
          type: isFile ? ("File" as const) : ("Directory" as const),
          mtime: Option.none(),
          atime: Option.none(),
          birthtime: Option.none(),
          dev: 0,
          ino: Option.none(),
          mode: fileModes.get(normalized) ?? DEFAULT_FILE_MODE,
          nlink: Option.none(),
          uid: Option.none(),
          gid: Option.none(),
          rdev: Option.none(),
          size: FileSystem.Size(size),
          blksize: Option.none(),
          blocks: Option.none(),
        });
      }),

    makeTempDirectoryScoped: options =>
      Effect.acquireRelease(
        Effect.suspend(() => {
          tempCounter += 1;
          const prefix = options?.prefix ?? "tmp-";
          const baseDir = options?.directory
            ? normalize(options.directory)
            : "/.tmp";
          if (options?.directory && !directories.has(baseDir)) {
            return Effect.fail(
              notFound("makeTempDirectoryScoped", options.directory)
            );
          }
          const tmpPath = `${baseDir}/${prefix}${tempCounter}`;
          directories.add(baseDir);
          directories.add(tmpPath);
          ensureParentDirectories(tmpPath);
          return Effect.succeed(tmpPath);
        }),
        tmpPath =>
          Effect.sync(() => {
            const prefix = tmpPath.endsWith("/") ? tmpPath : `${tmpPath}/`;
            for (const key of Array.from(files.keys())) {
              if (key.startsWith(prefix)) {
                files.delete(key);
                fileModes.delete(key);
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
