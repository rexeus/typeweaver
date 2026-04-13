export class DuplicateResponseNameError extends Error {
  public constructor(responseName: string) {
    super(
      `Response name '${responseName}' must be globally unique within a spec.`
    );
    this.name = "DuplicateResponseNameError";
  }
}
