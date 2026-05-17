import { Data } from "effect";

export type UnsafeCleanTargetReason =
  | "empty-path"
  | "filesystem-root"
  | "current-working-directory"
  | "workspace-root"
  | "ancestor-of-current-working-directory"
  | "target-carries-workspace-marker"
  | "contains-input-file";

export class UnsafeCleanTargetError extends Data.TaggedError(
  "UnsafeCleanTargetError"
)<{
  readonly outputDir: string;
  readonly reason: UnsafeCleanTargetReason;
  readonly resolvedOutputDir?: string;
  readonly currentWorkingDirectory?: string;
  readonly protectedWorkspaceRoot?: string;
  readonly filesystemRoot?: string;
  readonly inputFile?: string;
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
      case "target-carries-workspace-marker":
        return `${targetDescription} because the target itself contains a workspace marker (one of '.git', 'pnpm-workspace.yaml', 'lerna.json', 'nx.json', 'turbo.json', 'rush.json', or a 'package.json' declaring workspaces) and would erase the workspace. ${suffix}`;
      case "contains-input-file":
        return `${targetDescription} because it contains the spec input file '${this.inputFile ?? ""}'; cleaning would delete the source. ${suffix}`;
    }
  }
}
