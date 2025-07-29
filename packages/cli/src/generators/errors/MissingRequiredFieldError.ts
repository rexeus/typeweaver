export class MissingRequiredFieldError extends Error {
  public constructor(
    public readonly entityType: "operation" | "response",
    public readonly entityName: string,
    public readonly missingField: string,
    public readonly file: string
  ) {
    super(
      `Missing required field '${missingField}' in ${entityType} '${entityName}' at \`${file}\``
    );
  }
}
