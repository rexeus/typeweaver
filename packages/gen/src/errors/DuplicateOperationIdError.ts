export class DuplicateOperationIdError extends Error {
  public constructor(operationId: string) {
    super(
      `Operation ID '${operationId}' must be globally unique within a spec.`
    );
    this.name = "DuplicateOperationIdError";
  }
}
