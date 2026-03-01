export class DefinitionCompilationError extends Error {
  public constructor(
    public readonly filePath: string,
    public readonly details: string
  ) {
    super(`Failed to compile definition at \`${filePath}\`. ${details}`);
  }
}
