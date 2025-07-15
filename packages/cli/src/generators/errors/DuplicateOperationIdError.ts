export class DuplicateOperationIdError extends Error {
  public constructor(
    public readonly operationId: string,
    public readonly firstFile: string,
    public readonly duplicateFile: string
  ) {
    super(
      `Duplicate operation ID '${operationId}' found.\n` +
      `  First defined in: \`${firstFile}\`\n` +
      `  Duplicate found in: \`${duplicateFile}\``
    );
  }
}