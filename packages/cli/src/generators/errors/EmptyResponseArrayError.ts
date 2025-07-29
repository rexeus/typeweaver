export class EmptyResponseArrayError extends Error {
  public constructor(
    public readonly operationId: string,
    public readonly file: string
  ) {
    super(
      `Operation '${operationId}' has no responses defined at \`${file}\`\n` +
        `  Operations must have at least one response definition`
    );
  }
}
