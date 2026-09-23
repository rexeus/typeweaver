/**
 * Output-target I/O for generation and drift checks: the clean-target guard,
 * output locking, cleanup, and directory preparation. The implementations live
 * in `internal/`; services and their tests use them through this module.
 */
export {
  assertSafeCleanTargetEffect,
  assertSafeCleanTargetEffectWith,
  ensureOutputDirectories,
  removeOutputDir,
} from "./internal/generatorOutputTarget.js";
export {
  cleanOutputDirPreservingLock,
  sweepOrphanTempdirs,
} from "./internal/generatorOutputCleanup.js";
export {
  releaseOutputLock,
  releaseOutputLockStrict,
} from "./internal/generatorOutputLocks.js";
export {
  acquireOutputLock,
  acquireOutputLockWith,
} from "./internal/outputLockAcquisition.js";
export type { OutputLock } from "./internal/outputLockOperations.js";
