import { SpecBundleError } from "./errors/specErrors.js";
import type { FileSystem } from "effect";
import type { BuildOptions } from "rolldown";

export type SpecBundlerConfig = {
  readonly inputFile: string;
  readonly specOutputDir: string;
  readonly externalImportBase?: string;
  readonly pinExternalImports?: boolean;
};

/** Minimal URL shape so Windows-path tests can inject a converter. */
export type FileUrlLike = { readonly href: string };
export type FileUrlConverter = (filePath: string) => FileUrlLike;

export type SpecBundlerDeps = {
  readonly build?: (options: BuildOptions) => Promise<unknown>;
  readonly existsSync?: (filePath: string) => boolean;
  readonly realpathSync?: (filePath: string) => string;
  readonly toFileUrl?: FileUrlConverter;
};

export type BundlePaths = {
  readonly bundledSpecFile: string;
  readonly stagedSpecFile: string;
  readonly wrapperFile: string;
  readonly wrapperImportSpecifier: string;
};

export type BundleOperation = {
  readonly config: SpecBundlerConfig;
  readonly deps: SpecBundlerDeps;
  readonly fileSystem: FileSystem.FileSystem;
  readonly paths: BundlePaths;
};

export const makeBundleError =
  (inputFile: string) =>
  (cause: unknown): SpecBundleError =>
    new SpecBundleError({ inputFile, cause });
