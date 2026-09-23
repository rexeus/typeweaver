import type { NormalizedSpec } from "../../NormalizedSpec.js";
import type { TypeweaverUserConfig } from "../../plugins/contextTypes.js";
import type {
  FileSystemService,
  PathSafetyShape,
  TemplateRendererShape,
} from "./pluginContextEffectIO.js";
import type { SyncAtomicFileSystem } from "./pluginContextFileWriter.js";

export type PluginContextBuilderDeps = {
  readonly pathSafety: PathSafetyShape;
  readonly templateRenderer: TemplateRendererShape;
  readonly syncAtomicFileSystem?: SyncAtomicFileSystem;
  /**
   * Backs the Effect-native context surface (`writeFileEffect`,
   * `renderTemplateEffect`). Captured at construction time so plugin
   * lifecycle stages keep `R = never` (ADR 0003) while their writes route
   * through the platform `FileSystem` service.
   */
  readonly fileSystem: FileSystemService;
};

export type PluginContextParams = {
  readonly outputDir: string;
  readonly inputDir: string;
  readonly config: TypeweaverUserConfig;
};

export type GeneratorContextParams = PluginContextParams & {
  readonly normalizedSpec: NormalizedSpec;
  readonly templateDir: string;
  readonly coreDir: string;
  readonly responsesOutputDir: string;
  readonly specOutputDir: string;
};

export type GeneratorContextDeps = {
  readonly pathSafety: PathSafetyShape;
  readonly templateRenderer: TemplateRendererShape;
  readonly syncAtomicFileSystem: SyncAtomicFileSystem;
  readonly fileSystem: FileSystemService;
};
