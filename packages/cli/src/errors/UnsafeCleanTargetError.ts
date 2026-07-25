import { Data } from "effect";

export type UnsafeCleanTargetDetails =
  | {
      readonly reason: "empty-path";
    }
  | {
      readonly reason: "filesystem-root";
      readonly resolvedOutputDir: string;
      readonly currentWorkingDirectory: string;
      readonly filesystemRoot: string;
    }
  | {
      readonly reason: "current-working-directory";
      readonly resolvedOutputDir: string;
      readonly currentWorkingDirectory: string;
    }
  | {
      readonly reason: "workspace-root";
      readonly resolvedOutputDir: string;
      readonly currentWorkingDirectory: string;
      readonly protectedWorkspaceRoot: string;
    }
  | {
      readonly reason: "ancestor-of-current-working-directory";
      readonly resolvedOutputDir: string;
      readonly currentWorkingDirectory: string;
    }
  | {
      readonly reason: "target-carries-workspace-marker";
      readonly resolvedOutputDir: string;
      readonly currentWorkingDirectory: string;
      readonly protectedWorkspaceRoot: string;
    }
  | {
      readonly reason: "contains-input-file";
      readonly resolvedOutputDir: string;
      readonly currentWorkingDirectory: string;
      readonly inputFile: string;
    };

export type UnsafeCleanTargetReason = UnsafeCleanTargetDetails["reason"];

export class UnsafeCleanTargetError extends Data.TaggedError(
  "UnsafeCleanTargetError"
)<{
  readonly outputDir: string;
  readonly details: UnsafeCleanTargetDetails;
}> {
  public get reason(): UnsafeCleanTargetReason {
    return this.details.reason;
  }

  public get resolvedOutputDir(): string | undefined {
    return "resolvedOutputDir" in this.details
      ? this.details.resolvedOutputDir
      : undefined;
  }

  public get currentWorkingDirectory(): string | undefined {
    return "currentWorkingDirectory" in this.details
      ? this.details.currentWorkingDirectory
      : undefined;
  }

  public get protectedWorkspaceRoot(): string | undefined {
    return "protectedWorkspaceRoot" in this.details
      ? this.details.protectedWorkspaceRoot
      : undefined;
  }

  public get filesystemRoot(): string | undefined {
    return "filesystemRoot" in this.details
      ? this.details.filesystemRoot
      : undefined;
  }

  public get inputFile(): string | undefined {
    return "inputFile" in this.details ? this.details.inputFile : undefined;
  }

  public override get message(): string {
    const targetDescription = `Refusing to use '${this.outputDir}' as the generated output directory`;
    const suffix = "Use a dedicated generated output directory instead.";

    switch (this.details.reason) {
      case "empty-path":
        return `Refusing to use an empty output directory path. ${suffix}`;
      case "filesystem-root":
        return `${targetDescription} because it resolves to the filesystem root '${this.details.filesystemRoot}'. ${suffix}`;
      case "current-working-directory":
        return `${targetDescription} because it resolves to the current working directory '${this.details.currentWorkingDirectory}'. ${suffix}`;
      case "workspace-root":
        return `${targetDescription} because it resolves to the protected workspace root '${this.details.protectedWorkspaceRoot}'. ${suffix}`;
      case "ancestor-of-current-working-directory":
        return `${targetDescription} because it resolves to an ancestor directory of the current working directory '${this.details.currentWorkingDirectory}'. ${suffix}`;
      case "target-carries-workspace-marker":
        return `${targetDescription} because the target itself contains a workspace marker (one of '.git', 'pnpm-workspace.yaml', 'lerna.json', 'nx.json', 'turbo.json', 'rush.json', or a 'package.json' declaring workspaces) and would erase the workspace. ${suffix}`;
      case "contains-input-file":
        return `Refusing to clean '${this.outputDir}' because it contains the spec input file '${this.details.inputFile}'; cleaning would delete the source. ${suffix}`;
    }
  }
}
