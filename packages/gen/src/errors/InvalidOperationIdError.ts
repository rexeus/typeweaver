export class InvalidOperationIdError extends Error {
  public constructor(operationId: string) {
    super(
      `Operation ID '${operationId}' is invalid. Use camelCase (preferred) or PascalCase. snake_case and kebab-case are not supported.`
    );
    this.name = "InvalidOperationIdError";
  }
}
