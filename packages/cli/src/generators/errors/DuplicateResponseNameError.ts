export class DuplicateResponseNameError extends Error {
  public constructor(
    public readonly responseName: string,
    public readonly firstFile: string,
    public readonly duplicateFile: string
  ) {
    super(
      `Duplicate response name '${responseName}' found.\n` +
      `  First defined in: \`${firstFile}\`\n` +
      `  Duplicate found in: \`${duplicateFile}\``
    );
  }
}