export class DuplicateResponseNameError extends Error {
  public readonly responseName: string;

  public constructor(responseName: string) {
    super(
      `Response name '${responseName}' must be globally unique within a spec.`
    );
    this.name = "DuplicateResponseNameError";
    this.responseName = responseName;
  }
}
