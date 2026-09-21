import path from "node:path";
import { ByteSize, Effect, FileSystem, Option } from "effect";
import {
  deleteDirectoryTree,
  deleteFile,
  directoryNotEmpty,
  hasDirectoryChildren,
  moveFileMode,
  normalize,
  notFound,
  parentExists,
} from "./inMemoryFileSystemStore.js";
import type { InMemoryStore } from "./inMemoryFileSystemStore.js";

export const makeRemoveOverride =
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

export const makeRealPathOverride =
  (store: InMemoryStore): FileSystem.FileSystem["realPath"] =>
  filePath =>
    Effect.suspend(() => {
      const normalized = normalize(filePath);
      return !store.files.has(normalized) && !store.directories.has(normalized)
        ? Effect.fail(notFound("realPath", filePath))
        : Effect.succeed(normalized);
    });

export const makeRenameOverride =
  (store: InMemoryStore): FileSystem.FileSystem["rename"] =>
  (oldPath, newPath) =>
    Effect.suspend(() => {
      const normalizedOld = normalize(oldPath);
      const normalizedNew = normalize(newPath);
      const bytes = store.files.get(normalizedOld);
      if (bytes === undefined) return Effect.fail(notFound("rename", oldPath));
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

export const makeChmodOverride =
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

export const makeStatOverride =
  (store: InMemoryStore): FileSystem.FileSystem["stat"] =>
  filePath =>
    Effect.suspend(() => {
      const normalized = normalize(filePath);
      const isFile = store.files.has(normalized);
      const isDirectory = store.directories.has(normalized);
      if (!isFile && !isDirectory)
        return Effect.fail(notFound("stat", filePath));
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
        mode: store.fileModes.get(normalized) ?? 0o644,
        nlink: Option.none(),
        uid: Option.none(),
        gid: Option.none(),
        rdev: Option.none(),
        size: ByteSize.bytes(size),
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
    return Effect.succeed(tempPath);
  });

export const makeTempDirectoryScopedOverride =
  (store: InMemoryStore): FileSystem.FileSystem["makeTempDirectoryScoped"] =>
  options =>
    Effect.acquireRelease(acquireTempDirectory(store, options), tempPath =>
      Effect.sync(() => deleteDirectoryTree(store, tempPath))
    );
