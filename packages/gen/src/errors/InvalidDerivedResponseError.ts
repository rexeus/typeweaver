export class InvalidDerivedResponseError extends Error {
  public constructor(responseName: string) {
    super(
      `Derived response '${responseName}' contains invalid lineage metadata.`
    );
    this.name = "InvalidDerivedResponseError";
  }
}
