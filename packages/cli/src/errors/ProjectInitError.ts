import { Data } from "effect";

export type ProjectInitFileSystemOperation =
  | "exists"
  | "stat"
  | "readDirectory"
  | "readPackage"
  | "readTemplate"
  | "makeDirectory"
  | "makeTempDirectory"
  | "writeFile"
  | "rename"
  | "remove";

const formatCause = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

export class InitTargetNotEmptyError extends Data.TaggedError(
  "InitTargetNotEmptyError"
)<{
  readonly targetDir: string;
  readonly entries: readonly string[];
}> {
  public override get message(): string {
    return `Init target '${this.targetDir}' is not empty: ${this.entries.join(", ")}.`;
  }
}

export class InitTargetNotDirectoryError extends Data.TaggedError(
  "InitTargetNotDirectoryError"
)<{
  readonly targetDir: string;
}> {
  public override get message(): string {
    return `Init target '${this.targetDir}' exists and is not a directory.`;
  }
}

export class InvalidInitPackageError extends Data.TaggedError(
  "InvalidInitPackageError"
)<{
  readonly packagePath: string;
  readonly reason: string;
}> {
  public override get message(): string {
    return `Cannot inspect existing package manifest '${this.packagePath}': ${this.reason}.`;
  }
}

export class InitFileConflictError extends Data.TaggedError(
  "InitFileConflictError"
)<{
  readonly filePath: string;
}> {
  public override get message(): string {
    return `Init file '${this.filePath}' appeared after preflight; rerun with --force to overwrite it explicitly.`;
  }
}

export class ProjectInitFileSystemError extends Data.TaggedError(
  "ProjectInitFileSystemError"
)<{
  readonly operation: ProjectInitFileSystemOperation;
  readonly path: string;
  readonly cause: unknown;
}> {
  public override get message(): string {
    return `Failed to ${this.operation} init path '${this.path}': ${formatCause(this.cause)}`;
  }
}

export class ProjectInitRollbackError extends Data.TaggedError(
  "ProjectInitRollbackError"
)<{
  readonly targetDir: string;
  readonly originalCause: unknown;
  readonly rollbackCause: unknown;
}> {
  public override get message(): string {
    return `Init failed and rollback could not fully restore '${this.targetDir}': ${formatCause(this.rollbackCause)}`;
  }
}

export type ProjectInitFailure =
  | InitFileConflictError
  | InitTargetNotDirectoryError
  | InitTargetNotEmptyError
  | InvalidInitPackageError
  | ProjectInitFileSystemError
  | ProjectInitRollbackError;
