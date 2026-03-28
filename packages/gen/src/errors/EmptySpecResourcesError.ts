export class EmptySpecResourcesError extends Error {
  public constructor() {
    super("Spec definition must contain at least one resource.");
    this.name = "EmptySpecResourcesError";
  }
}
