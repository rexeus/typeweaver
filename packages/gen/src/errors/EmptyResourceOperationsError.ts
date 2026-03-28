export class EmptyResourceOperationsError extends Error {
  public constructor(resourceName: string) {
    super(`Resource '${resourceName}' must contain at least one operation.`);
    this.name = "EmptyResourceOperationsError";
  }
}
