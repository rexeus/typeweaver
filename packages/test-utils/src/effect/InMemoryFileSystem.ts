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

const directoryNotEmpty = (
  filePath: string
): InstanceType<typeof SystemError> =>
  new SystemError({
    reason: "AlreadyExists",
    module: "FileSystem",
    method: "remove",
    pathOrDescriptor: filePath,
    description: `In-memory filesystem: directory '${filePath}' is not empty; pass { recursive: true } to remove it`,
  });

const DEFAULT_FILE_MODE = 0o644;

type InMemoryStore = {
  readonly files: Map<string, Uint8Array>;
  readonly directories: Set<string>;
  readonly fileModes: Map<string, number>;
  tempCounter: number;
};

const createStore = (): InMemoryStore => ({
  files: new Map(),
  directories: new Set(["/"]),
  fileModes: new Map(),
  tempCounter: 0,
});

const ensureParentDirectories = (
  store: InMemoryStore,
  filePath: string
): void => {
  for (const directory of parents(filePath)) {
    store.directories.add(directory);
  }
};

const parentExists = (store: InMemoryStore, filePath: string): boolean =>
  store.directories.has(path.posix.dirname(filePath));

const deleteFile = (store: InMemoryStore, filePath: string): void => {
  store.files.delete(filePath);
  store.fileModes.delete(filePath);
};

const deleteDirectoryTree = (
  store: InMemoryStore,
  directoryPath: string
): void => {
  const prefix = directoryPath.endsWith("/")
    ? directoryPath
    : `${directoryPath}/`;
  for (const filePath of Array.from(store.files.keys())) {
    if (filePath.startsWith(prefix)) {
      deleteFile(store, filePath);
    }
  }
  for (const storedDirectory of Array.from(store.directories)) {
    if (
      storedDirectory === directoryPath ||
      storedDirectory.startsWith(prefix)
    ) {
      store.directories.delete(storedDirectory);
    }
  }
};

const hasDirectoryChildren = (
  store: InMemoryStore,
  directoryPath: string
): boolean => {
  const prefix = directoryPath.endsWith("/")
    ? directoryPath
    : `${directoryPath}/`;
  const hasFiles = Array.from(store.files.keys()).some(filePath =>
    filePath.startsWith(prefix)
  );
  return (
    hasFiles ||
    Array.from(store.directories).some(
      storedDirectory =>
        storedDirectory !== directoryPath && storedDirectory.startsWith(prefix)
    )
  );
};

const createState = (store: InMemoryStore): InMemoryFsState => ({
  readFile: filePath => {
    const bytes = store.files.get(normalize(filePath));
    return bytes === undefined ? undefined : decoder.decode(bytes);
  },
  hasFile: filePath => store.files.has(normalize(filePath)),
  fileMode: filePath =>
    store.files.has(normalize(filePath))
      ? (store.fileModes.get(normalize(filePath)) ?? DEFAULT_FILE_MODE)
      : undefined,
  listFiles: () => Array.from(store.files.keys()).sort(),
  listDirectories: () => Array.from(store.directories).sort(),
  reset: () => {
    store.files.clear();
    store.directories.clear();
    store.fileModes.clear();
    store.directories.add("/");
    store.tempCounter = 0;
  },
});

const makeDirectoryOverride =
  (store: InMemoryStore): FileSystem.FileSystem["makeDirectory"] =>
  (dirPath, options) =>
    Effect.suspend(() => {
      const normalized = normalize(dirPath);
      if (options?.recursive !== true && !parentExists(store, normalized)) {
        return Effect.fail(
          notFound("makeDirectory", path.posix.dirname(normalized))
        );
      }
      store.directories.add(normalized);
      if (options?.recursive === true) {
        ensureParentDirectories(store, normalized);
      }
      return Effect.void;
    });

const makeWriteFileStringOverride =
  (store: InMemoryStore): FileSystem.FileSystem["writeFileString"] =>
  (filePath, content) =>
    Effect.suspend(() => {
      const normalized = normalize(filePath);
      if (!parentExists(store, normalized)) {
        return Effect.fail(notFound("writeFileString", filePath));
      }
      store.files.set(normalized, encoder.encode(content));
      return Effect.void;
    });

const makeWriteFileOverride =
  (store: InMemoryStore): FileSystem.FileSystem["writeFile"] =>
  (filePath, data) =>
    Effect.suspend(() => {
      const normalized = normalize(filePath);
      if (!parentExists(store, normalized)) {
        return Effect.fail(notFound("writeFile", filePath));
      }
      store.files.set(normalized, Uint8Array.from(data));
      return Effect.void;
    });

const makeReadFileStringOverride =
  (store: InMemoryStore): FileSystem.FileSystem["readFileString"] =>
  filePath =>
    Effect.suspend(() => {
      const bytes = store.files.get(normalize(filePath));
      if (bytes === undefined) {
        return Effect.fail(notFound("readFileString", filePath));
      }
      return Effect.succeed(decoder.decode(bytes));
    });

const makeReadFileOverride =
  (store: InMemoryStore): FileSystem.FileSystem["readFile"] =>
  filePath =>
    Effect.suspend(() => {
      const bytes = store.files.get(normalize(filePath));
      if (bytes === undefined) {
        return Effect.fail(notFound("readFile", filePath));
      }
      return Effect.succeed(bytes);
    });

const listDirectoryEntries = (
  store: InMemoryStore,
  directoryPath: string
): string[] => {
  const entries = new Set<string>();
  for (const filePath of store.files.keys()) {
    if (path.posix.dirname(filePath) === directoryPath) {
      entries.add(path.posix.basename(filePath));
    }
  }
  for (const storedDirectory of store.directories) {
    if (
      storedDirectory !== directoryPath &&
      path.posix.dirname(storedDirectory) === directoryPath
    ) {
      entries.add(path.posix.basename(storedDirectory));
    }
  }
  return Array.from(entries).sort();
};

const makeReadDirectoryOverride =
  (store: InMemoryStore): FileSystem.FileSystem["readDirectory"] =>
  dirPath =>
    Effect.suspend(() => {
      const normalized = normalize(dirPath);
      if (!store.directories.has(normalized)) {
        return Effect.fail(notFound("readDirectory", dirPath));
      }
      return Effect.succeed(listDirectoryEntries(store, normalized));
    });

const makeExistsOverride =
  (store: InMemoryStore): FileSystem.FileSystem["exists"] =>
  filePath =>
    Effect.sync(() => {
      const normalized = normalize(filePath);
      return store.files.has(normalized) || store.directories.has(normalized);
    });

const makeRemoveOverride =
  (store: InMemoryStore): FileSystem.FileSystem["remove"] =>
  (filePath, options) =>
    Effect.suspend(() => {
      const normalized = normalize(filePath);
      const isFile = store.files.has(normalized);
      const isDirectory = store.directories.has(normalized);
      if (!isFile && !isDirectory) {
        return options?.force === true
          ? Effect.void
          : Effect.fail(notFound("remove", filePath));
      }
      if (isFile) {
        deleteFile(store, normalized);
        return Effect.void;
      }
      if (options?.recursive === true) {
        deleteDirectoryTree(store, normalized);
        return Effect.void;
      }
      if (hasDirectoryChildren(store, normalized)) {
        return Effect.fail(directoryNotEmpty(filePath));
      }
      store.directories.delete(normalized);
      return Effect.void;
    });

const makeRealPathOverride =
  (store: InMemoryStore): FileSystem.FileSystem["realPath"] =>
  filePath =>
    Effect.suspend(() => {
      const normalized = normalize(filePath);
      if (!store.files.has(normalized) && !store.directories.has(normalized)) {
        return Effect.fail(notFound("realPath", filePath));
      }
      return Effect.succeed(normalized);
    });

const moveFileMode = (
  store: InMemoryStore,
  oldPath: string,
  newPath: string
): void => {
  const mode = store.fileModes.get(oldPath);
  store.fileModes.delete(oldPath);
  if (mode !== undefined) {
    store.fileModes.set(newPath, mode);
  }
};

const makeRenameOverride =
  (store: InMemoryStore): FileSystem.FileSystem["rename"] =>
  (oldPath, newPath) =>
    Effect.suspend(() => {
      const normalizedOld = normalize(oldPath);
      const normalizedNew = normalize(newPath);
      const bytes = store.files.get(normalizedOld);
      if (bytes === undefined) {
        return Effect.fail(notFound("rename", oldPath));
      }
      if (!parentExists(store, normalizedNew)) {
        return Effect.fail(
          notFound("rename", path.posix.dirname(normalizedNew))
        );
      }
      store.files.delete(normalizedOld);
      store.files.set(normalizedNew, bytes);
      moveFileMode(store, normalizedOld, normalizedNew);
      return Effect.void;
    });

const makeChmodOverride =
  (store: InMemoryStore): FileSystem.FileSystem["chmod"] =>
  (filePath, mode) =>
    Effect.suspend(() => {
      const normalized = normalize(filePath);
      if (!store.files.has(normalized) && !store.directories.has(normalized)) {
        return Effect.fail(notFound("chmod", filePath));
      }
      store.fileModes.set(normalized, mode);
      return Effect.void;
    });

const makeStatOverride =
  (store: InMemoryStore): FileSystem.FileSystem["stat"] =>
  filePath =>
    Effect.suspend(() => {
      const normalized = normalize(filePath);
      const isFile = store.files.has(normalized);
      const isDirectory = store.directories.has(normalized);
      if (!isFile && !isDirectory) {
        return Effect.fail(notFound("stat", filePath));
      }
      const size = isFile
        ? BigInt(store.files.get(normalized)?.length ?? 0)
        : BigInt(0);
      return Effect.succeed({
        type: isFile ? ("File" as const) : ("Directory" as const),
        mtime: Option.none(),
        atime: Option.none(),
        birthtime: Option.none(),
        dev: 0,
        ino: Option.none(),
        mode: store.fileModes.get(normalized) ?? DEFAULT_FILE_MODE,
        nlink: Option.none(),
        uid: Option.none(),
        gid: Option.none(),
        rdev: Option.none(),
        size: FileSystem.Size(size),
        blksize: Option.none(),
        blocks: Option.none(),
      });
    });

const acquireTempDirectory = (
  store: InMemoryStore,
  options: Parameters<FileSystem.FileSystem["makeTempDirectoryScoped"]>[0]
) =>
  Effect.suspend(() => {
    store.tempCounter += 1;
    const prefix = options?.prefix ?? "tmp-";
    const baseDir =
      options?.directory === undefined ? "/.tmp" : normalize(options.directory);
    if (options?.directory !== undefined && !store.directories.has(baseDir)) {
      return Effect.fail(
        notFound("makeTempDirectoryScoped", options.directory)
      );
    }
    const tempPath = `${baseDir}/${prefix}${store.tempCounter}`;
    store.directories.add(baseDir);
    store.directories.add(tempPath);
    ensureParentDirectories(store, tempPath);
    return Effect.succeed(tempPath);
  });

const makeTempDirectoryScopedOverride =
  (store: InMemoryStore): FileSystem.FileSystem["makeTempDirectoryScoped"] =>
  options =>
    Effect.acquireRelease(acquireTempDirectory(store, options), tempPath =>
      Effect.sync(() => {
        deleteDirectoryTree(store, tempPath);
      })
    );

const createOverrides = (
  store: InMemoryStore
): Partial<FileSystem.FileSystem> => ({
  makeDirectory: makeDirectoryOverride(store),
  writeFileString: makeWriteFileStringOverride(store),
  writeFile: makeWriteFileOverride(store),
  readFileString: makeReadFileStringOverride(store),
  readFile: makeReadFileOverride(store),
  readDirectory: makeReadDirectoryOverride(store),
  exists: makeExistsOverride(store),
  remove: makeRemoveOverride(store),
  realPath: makeRealPathOverride(store),
  rename: makeRenameOverride(store),
  chmod: makeChmodOverride(store),
  stat: makeStatOverride(store),
  makeTempDirectoryScoped: makeTempDirectoryScopedOverride(store),
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
  const store = createStore();
  return {
    layer: Layer.succeed(
      FileSystem.FileSystem,
      FileSystem.makeNoop(createOverrides(store))
    ),
    state: createState(store),
  };
};
