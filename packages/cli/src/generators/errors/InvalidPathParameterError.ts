export class InvalidPathParameterError extends Error {
  public constructor(
    public readonly operationId: string,
    public readonly path: string,
    public readonly issue: string,
    public readonly file: string
  ) {
    super(
      `Invalid path parameters in operation '${operationId}' at \`${file}\`\n` +
      `  Path: ${path}\n` +
      `  Issue: ${issue}`
    );
  }
}