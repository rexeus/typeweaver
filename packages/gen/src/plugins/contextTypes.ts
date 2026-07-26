import type { GeneratedPathProbeError } from "../errors/GeneratedPathProbeError.js";
import type { TemplateRenderError } from "../errors/TemplateRenderError.js";
import type { UnsafeGeneratedPathError } from "../errors/UnsafeGeneratedPathError.js";
import type { NormalizedResponse, NormalizedSpec } from "../NormalizedSpec.js";
import type { PlatformError } from "@effect/platform/Error";
import type { Effect } from "effect";

/**
 * Per-plugin configuration passed in the tuple form
 * `plugins: [["clients", { someOption: true }]]`. Plugins receive this value
 * as their factory argument (`(cfg?: PluginConfig) => Plugin`).
 */
export type PluginConfig = Record<string, unknown>;

/**
 * Named values exposed to an EJS-like template during rendering. `null` and
 * `undefined` intentionally render with an empty data object.
 */
export type TemplateData = Readonly<Record<string, unknown>> | null | undefined;

/**
 * The full Typeweaver user config object, surfaced to plugin authors through
 * `PluginContext.config`. Plugins should read whatever top-level keys are
 * relevant to them (e.g. `output`, `plugins`, custom keys added by a
 * plugin's documentation). This is intentionally typed as a permissive
 * record so plugin authors can extend the config without TypeScript
 * complaints at the consumer boundary.
 */
export type TypeweaverUserConfig = Record<string, unknown>;

/**
 * Context provided to plugins during initialization and finalization.
 */
export type PluginContext = {
  readonly outputDir: string;
  readonly inputDir: string;
  readonly config: TypeweaverUserConfig;
};

export type OperationOutputPaths = {
  readonly outputDir: string;
  readonly requestFile: string;
  readonly requestFileName: string;
  readonly responseFile: string;
  readonly responseFileName: string;
  readonly requestValidationFile: string;
  readonly requestValidationFileName: string;
  readonly responseValidationFile: string;
  readonly responseValidationFileName: string;
  readonly clientFile: string;
  readonly clientFileName: string;
};

/**
 * Context provided to plugins during generation.
 */
export type GeneratorContext = PluginContext & {
  readonly normalizedSpec: NormalizedSpec;
  readonly coreDir: string;
  readonly responsesOutputDir: string;
  readonly specOutputDir: string;

  readonly getCanonicalResponse: (responseName: string) => NormalizedResponse;
  readonly getCanonicalResponseOutputFile: (responseName: string) => string;
  readonly getCanonicalResponseImportPath: (params: {
    readonly importerDir: string;
    readonly responseName: string;
  }) => string;
  readonly getSpecImportPath: (params: {
    readonly importerDir: string;
  }) => string;
  readonly getOperationDefinitionAccessor: (params: {
    readonly resourceName: string;
    readonly operationId: string;
  }) => string;
  readonly getOperationOutputPaths: (params: {
    readonly resourceName: string;
    readonly operationId: string;
  }) => OperationOutputPaths;
  readonly getResourceOutputDir: (resourceName: string) => string;

  /**
   * Write a file relative to `outputDir`. Synchronous; any throw is caught by
   * the outer `Effect.try` wrapper inside `Plugin.generate` and surfaces as
   * `PluginExecutionError`.
   *
   * - Performs an atomic temp-file + rename to avoid partial writes leaking to
   *   downstream consumers if the process is interrupted mid-write.
   * - Rejects unsafe paths (absolute paths, parent-traversal,
   *   symlink-component escapes) via the shared path-safety guard, throwing
   *   `UnsafeGeneratedPathError`.
   * - Registers the resolved generated path with the run's file tracker so
   *   barrel emission picks it up.
   * - Queues a `Generated: <path>` log line that the orchestrator flushes
   *   through `Effect.logInfo` after the plugin's `generate` stage — the
   *   lines flow through the configured logger pipeline and their relative
   *   order stays stable.
   */
  readonly writeFile: (relativePath: string, content: string) => void;

  /**
   * Read and render an EJS-like template to a string. Synchronous filesystem
   * and template-evaluation failures throw and are caught by the outer
   * `Effect.try` boundary.
   *
   * `templatePath` may be absolute, or relative to the plugin's
   * `templateDir`. The template engine resolves `<%- %>` (raw output) and
   * `<%= %>` (escaped output) per the project's hand-rolled renderer.
   */
  readonly renderTemplate: (templatePath: string, data: TemplateData) => string;

  /**
   * Register a generated file without writing it (the file was produced by
   * some other path, e.g. `copyPluginLibFiles`). Synchronous; rejects unsafe
   * paths via the same guard as `writeFile`.
   *
   * The path is added to the run's file tracker so the index-file generator
   * can include it in the per-domain or root barrel.
   */
  readonly addGeneratedFile: (relativePath: string) => void;

  /**
   * Snapshot of every generated path registered so far during the current
   * run, sorted lexicographically for determinism. Pure read-only accessor.
   */
  readonly getGeneratedFiles: () => string[];

  /**
   * Effect-native counterpart of `writeFile` for plugins written in Effect
   * style. Same guarantees as the sync path — path-traversal guard, atomic
   * temp-file + rename replace, mode preservation, file tracking, queued
   * `Generated: <path>` log line — but expressed over the platform
   * `FileSystem` service, with a closed typed error channel instead of a
   * throw caught by `Effect.try`.
   *
   * The `FileSystem` is captured when the context is built, so lifecycle
   * stages keep `R = never` (ADR 0003). Map failures into
   * `PluginExecutionError` before returning them from a lifecycle stage:
   *
   * ```ts
   * yield* context
   *   .writeFileEffect("todo/GetTodo.ts", source)
   *   .pipe(
   *     Effect.mapError(
   *       cause => new PluginExecutionError({ pluginName, phase: "generate", cause })
   *     )
   *   );
   * ```
   */
  readonly writeFileEffect: (
    relativePath: string,
    content: string
  ) => Effect.Effect<
    void,
    GeneratedPathProbeError | UnsafeGeneratedPathError | PlatformError
  >;

  /**
   * Effect-native counterpart of `renderTemplate`. Reads the template file
   * through the platform `FileSystem` service (typed `PlatformError`
   * instead of a thrown `ENOENT`) and surfaces malformed templates as
   * `TemplateRenderError`.
   */
  readonly renderTemplateEffect: (
    templatePath: string,
    data: TemplateData
  ) => Effect.Effect<string, TemplateRenderError | PlatformError>;

  /**
   * Effect-native counterpart of `addGeneratedFile`: registers an
   * externally-produced file with the run's tracker, rejecting unsafe
   * paths on the typed error channel.
   */
  readonly addGeneratedFileEffect: (
    relativePath: string
  ) => Effect.Effect<void, GeneratedPathProbeError | UnsafeGeneratedPathError>;
};

/**
 * Plugin metadata.
 */
export type PluginMetadata = {
  readonly name: string;
  readonly depends?: readonly string[];
};

/**
 * Typeweaver configuration. Known generator fields are strongly typed while
 * custom top-level keys remain available to plugins through `context.config`.
 */
export type TypeweaverConfig = TypeweaverUserConfig & {
  input: string;
  output: string;
  plugins?: (string | [string, PluginConfig])[];
  format?: boolean;
  clean?: boolean;
};
