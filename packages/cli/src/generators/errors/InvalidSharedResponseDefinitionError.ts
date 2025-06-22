export class InvalidSharedResponseDefinitionError extends Error {
  public constructor(
    public readonly fileName: string,
    public readonly dir: string,
    public readonly file: string,
    public readonly explanation: string
  ) {
    super("Invalid shared response definition");
  }
}
