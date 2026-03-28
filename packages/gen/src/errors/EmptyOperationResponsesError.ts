export class EmptyOperationResponsesError extends Error {
  public constructor(operationId: string) {
    super(`Operation '${operationId}' must declare at least one response.`);
    this.name = "EmptyOperationResponsesError";
  }
}
