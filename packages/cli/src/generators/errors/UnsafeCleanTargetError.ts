export type UnsafeCleanTargetReason =
  | "empty-path"
  | "filesystem-root"
  | "current-working-directory"
  | "workspace-root"
  | "ancestor-of-current-working-directory";

export type UnsafeCleanTargetDiagnostics = {
  readonly resolvedOutputDir?: string;
  readonly currentWorkingDirectory?: string;
  readonly protectedWorkspaceRoot?: string;
  readonly filesystemRoot?: string;
};

export class UnsafeCleanTargetError extends Error {
  public override readonly name = "UnsafeCleanTargetError";
  public readonly resolvedOutputDir: string | undefined;
  public readonly currentWorkingDirectory: string | undefined;
  public readonly protectedWorkspaceRoot: string | undefined;
  public readonly filesystemRoot: string | undefined;

  public constructor(
    public readonly outputDir: string,
    public readonly reason: UnsafeCleanTargetReason,
    diagnostics: UnsafeCleanTargetDiagnostics = {}
  ) {
    super(getUnsafeCleanTargetMessage(outputDir, reason, diagnostics));
    this.resolvedOutputDir = diagnostics.resolvedOutputDir;
    this.currentWorkingDirectory = diagnostics.currentWorkingDirectory;
    this.protectedWorkspaceRoot = diagnostics.protectedWorkspaceRoot;
    this.filesystemRoot = diagnostics.filesystemRoot;
  }
}

const getUnsafeCleanTargetMessage = (
  outputDir: string,
  reason: UnsafeCleanTargetReason,
  diagnostics: UnsafeCleanTargetDiagnostics
): string => {
  const targetDescription = `Refusing to clean '${outputDir}'`;
  const suffix = "Use a dedicated generated output directory instead.";

  switch (reason) {
    case "empty-path":
      return `Refusing to clean an empty output directory path. ${suffix}`;
    case "filesystem-root":
      return `${targetDescription} because it resolves to the filesystem root '${diagnostics.filesystemRoot ?? diagnostics.resolvedOutputDir ?? outputDir}'. ${suffix}`;
    case "current-working-directory":
      return `${targetDescription} because it resolves to the current working directory '${diagnostics.currentWorkingDirectory ?? diagnostics.resolvedOutputDir ?? outputDir}'. ${suffix}`;
    case "workspace-root":
      return `${targetDescription} because it resolves to the protected workspace root '${diagnostics.protectedWorkspaceRoot ?? diagnostics.resolvedOutputDir ?? outputDir}'. ${suffix}`;
    case "ancestor-of-current-working-directory":
      return `${targetDescription} because it resolves to an ancestor directory of the current working directory '${diagnostics.currentWorkingDirectory ?? ""}'. ${suffix}`;
  }
};
