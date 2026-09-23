import { FileSystem, Layer } from "effect";
import {
  makeChmodOverride,
  makeRealPathOverride,
  makeRemoveOverride,
  makeRenameOverride,
  makeStatOverride,
  makeTempDirectoryScopedOverride,
} from "./inMemoryFileSystemAdvanced.js";
import {
  makeExistsOverride,
  makeReadDirectoryOverride,
  makeReadFileOverride,
  makeReadFileStringOverride,
  makeWriteFileOverride,
  makeWriteFileStringOverride,
  makeDirectoryOverride,
} from "./inMemoryFileSystemBasic.js";
import { createState, createStore } from "./inMemoryFileSystemStore.js";
import type {
  InMemoryFsState,
  InMemoryStore,
} from "./inMemoryFileSystemStore.js";

export type { InMemoryFsState };

export type InMemoryFileSystemHandle = {
  readonly layer: Layer.Layer<FileSystem.FileSystem>;
  readonly state: InMemoryFsState;
};

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
 * Test-only `FileSystem.FileSystem` layer backed by an in-memory store.
 *
 * Supports the operations typeweaver's services actually use:
 *   - `makeDirectory`, `writeFile`, `writeFileString`, `readFile`,
 *     `readFileString`, `readDirectory`
 *   - `remove`, `exists`, `realPath`
 *   - `rename`, `stat`, `chmod` (atomic-replace write path)
 *   - `makeTempDirectoryScoped` (honors the `directory` option)
 *
 * Unsupported methods inherit no-op stubs from `FileSystem.makeNoop`. Use
 * this layer in tests to substitute for `NodeFileSystem.layer`:
 *
 *   const { layer, state } = makeInMemoryFileSystem();
 *   await Effect.runPromise(program.pipe(Effect.provide(layer)));
 *
 * The `state` handle exposes the stored files and directories for assertions.
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
