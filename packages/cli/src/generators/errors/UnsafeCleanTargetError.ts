import { Data } from "effect";

export type UnsafeCleanTargetReason =
  | "empty-path"
  | "filesystem-root"
  | "current-working-directory"
  | "workspace-root"
  | "ancestor-of-current-working-directory";

export class UnsafeCleanTargetError extends Data.TaggedError(
  "UnsafeCleanTargetError"
)<{
  readonly outputDir: string;
  readonly reason: UnsafeCleanTargetReason;
  readonly resolvedOutputDir?: string;
  readonly currentWorkingDirectory?: string;
  readonly protectedWorkspaceRoot?: string;
  readonly filesystemRoot?: string;
}> {
  public override get message(): string {
    const targetDescription = `Refusing to clean '${this.outputDir}'`;
    const suffix = "Use a dedicated generated output directory instead.";

    switch (this.reason) {
      case "empty-path":
        return `Refusing to clean an empty output directory path. ${suffix}`;
      case "filesystem-root":
        return `${targetDescription} because it resolves to the filesystem root '${this.filesystemRoot ?? this.resolvedOutputDir ?? this.outputDir}'. ${suffix}`;
      case "current-working-directory":
        return `${targetDescription} because it resolves to the current working directory '${this.currentWorkingDirectory ?? this.resolvedOutputDir ?? this.outputDir}'. ${suffix}`;
      case "workspace-root":
        return `${targetDescription} because it resolves to the protected workspace root '${this.protectedWorkspaceRoot ?? this.resolvedOutputDir ?? this.outputDir}'. ${suffix}`;
      case "ancestor-of-current-working-directory":
        return `${targetDescription} because it resolves to an ancestor directory of the current working directory '${this.currentWorkingDirectory ?? ""}'. ${suffix}`;
    }
  }
}
