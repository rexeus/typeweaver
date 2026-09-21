import path from "node:path";
import { Effect, FileSystem } from "effect";
import {
  ensureParentDirectories,
  normalize,
  notFound,
  parentExists,
} from "./inMemoryFileSystemStore.js";
import type { InMemoryStore } from "./inMemoryFileSystemStore.js";

const encoder = new TextEncoder();

export const makeDirectoryOverride =
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

export const makeWriteFileStringOverride =
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

export const makeWriteFileOverride =
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

export const makeReadFileStringOverride =
  (store: InMemoryStore): FileSystem.FileSystem["readFileString"] =>
  filePath =>
    Effect.suspend(() => {
      const bytes = store.files.get(normalize(filePath));
      return bytes === undefined
        ? Effect.fail(notFound("readFileString", filePath))
        : Effect.succeed(new TextDecoder().decode(bytes));
    });

export const makeReadFileOverride =
  (store: InMemoryStore): FileSystem.FileSystem["readFile"] =>
  filePath =>
    Effect.suspend(() => {
      const bytes = store.files.get(normalize(filePath));
      return bytes === undefined
        ? Effect.fail(notFound("readFile", filePath))
        : Effect.succeed(bytes);
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

export const makeReadDirectoryOverride =
  (store: InMemoryStore): FileSystem.FileSystem["readDirectory"] =>
  dirPath =>
    Effect.suspend(() => {
      const normalized = normalize(dirPath);
      return !store.directories.has(normalized)
        ? Effect.fail(notFound("readDirectory", dirPath))
        : Effect.succeed(listDirectoryEntries(store, normalized));
    });

export const makeExistsOverride =
  (store: InMemoryStore): FileSystem.FileSystem["exists"] =>
  filePath =>
    Effect.sync(() => {
      const normalized = normalize(filePath);
      return store.files.has(normalized) || store.directories.has(normalized);
    });
