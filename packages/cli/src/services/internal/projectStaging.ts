export {
  assertStagingParentSafe,
  linkDirectory,
  linkNearestNodeModules,
  withStagedProject,
} from "./projectStagingCore.js";
export type { StagedProjectParams } from "./projectStagingCore.js";
export {
  prepareMirroredOutput,
  withMirroredOutputStage,
} from "./projectStagingMirror.js";
export type { MirroredStage } from "./projectStagingMirror.js";
