import { Data } from "effect";

export type UnsafeGeneratedPathReason =
  | "empty-path"
  | "absolute-path"
  | "parent-traversal"
  | "trailing-separator"
  | "current-directory"
  | "escapes-output"
  | "symlink-component"
  | "nul-byte";

export class UnsafeGeneratedPathError extends Data.TaggedError(
  "UnsafeGeneratedPathError"
)<{
  readonly requestedPath: string;
  readonly reason: UnsafeGeneratedPathReason;
}> {
  public override get message(): string {
    return (
      `Unsafe generated file path '${this.requestedPath}': ${reasonText(this.reason)}. ` +
      `Generated writes must stay inside the output directory.`
    );
  }
}

const reasonText = (reason: UnsafeGeneratedPathReason): string => {
  switch (reason) {
    case "empty-path":
      return "path must not be empty";
    case "absolute-path":
      return "absolute paths are not allowed";
    case "parent-traversal":
      return "path contains parent-directory traversal";
    case "trailing-separator":
    case "current-directory":
      return "path must name a file inside the output directory";
    case "escapes-output":
      return "path escapes the output directory";
    case "symlink-component":
      return "path contains a symbolic link";
    case "nul-byte":
      return "path must not contain NUL bytes";
  }
};
