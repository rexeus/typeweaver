export class ReservedKeywordError extends Error {
  public constructor(
    public readonly entityType: "operationId" | "responseName" | "entityName",
    public readonly identifier: string,
    public readonly file: string
  ) {
    super(
      `Reserved keyword '${identifier}' cannot be used as ${entityType}.\n` +
        `  File: \`${file}\`\n` +
        `  '${identifier}' is a reserved JavaScript/TypeScript keyword and would produce invalid generated code.\n` +
        `  Please choose a different name.`
    );
  }
}
