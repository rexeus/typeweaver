export class ReservedEntityNameError extends Error {
  public constructor(
    public readonly entityName: string,
    public readonly file: string
  ) {
    super(
      `Reserved entity name '${entityName}' cannot be used as a resource directory.\n` +
        `  Directory: \`${file}\`\n` +
        `  '${entityName}' is reserved by Typeweaver for internal use and would conflict with the generated output structure.\n` +
        `  Please choose a different directory name.`
    );
  }
}
