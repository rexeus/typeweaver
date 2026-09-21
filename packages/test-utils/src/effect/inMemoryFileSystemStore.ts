import path from "node:path";
import { systemError } from "effect/PlatformError";
import type { PlatformError } from "effect/PlatformError";

export type InMemoryFsState = {
  readonly readFile: (filePath: string) => string | undefined;
  readonly hasFile: (filePath: string) => boolean;
  readonly fileMode: (filePath: string) => number | undefined;
  readonly listFiles: () => readonly string[];
  readonly listDirectories: () => readonly string[];
  readonly reset: () => void;
};

export const DEFAULT_FILE_MODE = 0o644;

export type InMemoryStore = {
  readonly files: Map<string, Uint8Array>;
  readonly directories: Set<string>;
  readonly fileModes: Map<string, number>;
  tempCounter: number;
};

export const normalize = (filePath: string): string =>
  path.posix.normalize(filePath);

export const parents = (filePath: string): readonly string[] => {
  const segments: string[] = [];
  let current = path.posix.dirname(filePath);
  while (current !== "/" && current !== ".") {
    segments.push(current);
    current = path.posix.dirname(current);
  }
  return segments;
};

export const notFound = (method: string, filePath: string): PlatformError =>
  systemError({
    _tag: "NotFound",
    module: "FileSystem",
    method,
    pathOrDescriptor: filePath,
    description: `In-memory filesystem: path '${filePath}' does not exist`,
  });

export const directoryNotEmpty = (filePath: string): PlatformError =>
  systemError({
    _tag: "AlreadyExists",
    module: "FileSystem",
    method: "remove",
    pathOrDescriptor: filePath,
    description: `In-memory filesystem: directory '${filePath}' is not empty; pass { recursive: true } to remove it`,
  });

export const createStore = (): InMemoryStore => ({
  files: new Map(),
  directories: new Set(["/"]),
  fileModes: new Map(),
  tempCounter: 0,
});

export const ensureParentDirectories = (
  store: InMemoryStore,
  filePath: string
): void => {
  for (const directory of parents(filePath)) store.directories.add(directory);
};

export const parentExists = (store: InMemoryStore, filePath: string): boolean =>
  store.directories.has(path.posix.dirname(filePath));

export const deleteFile = (store: InMemoryStore, filePath: string): void => {
  store.files.delete(filePath);
  store.fileModes.delete(filePath);
};

export const deleteDirectoryTree = (
  store: InMemoryStore,
  directoryPath: string
): void => {
  const prefix = directoryPath.endsWith("/")
    ? directoryPath
    : `${directoryPath}/`;
  for (const filePath of Array.from(store.files.keys())) {
    if (filePath.startsWith(prefix)) deleteFile(store, filePath);
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

export const hasDirectoryChildren = (
  store: InMemoryStore,
  directoryPath: string
): boolean => {
  const prefix = directoryPath.endsWith("/")
    ? directoryPath
    : `${directoryPath}/`;
  return (
    Array.from(store.files.keys()).some(filePath =>
      filePath.startsWith(prefix)
    ) ||
    Array.from(store.directories).some(
      storedDirectory =>
        storedDirectory !== directoryPath && storedDirectory.startsWith(prefix)
    )
  );
};

const decoder = new TextDecoder();

export const createState = (store: InMemoryStore): InMemoryFsState => ({
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

export const moveFileMode = (
  store: InMemoryStore,
  oldPath: string,
  newPath: string
): void => {
  const mode = store.fileModes.get(oldPath);
  store.fileModes.delete(oldPath);
  if (mode !== undefined) store.fileModes.set(newPath, mode);
};
