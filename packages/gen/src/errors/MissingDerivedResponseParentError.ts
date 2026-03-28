export class MissingDerivedResponseParentError extends Error {
  public constructor(responseName: string, parentName: string) {
    super(
      `Derived response '${responseName}' references missing canonical parent '${parentName}'.`
    );
    this.name = "MissingDerivedResponseParentError";
  }
}
