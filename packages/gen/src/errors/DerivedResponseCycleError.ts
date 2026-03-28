export class DerivedResponseCycleError extends Error {
  public constructor(responseName: string) {
    super(`Derived response '${responseName}' contains a cyclic lineage.`);
    this.name = "DerivedResponseCycleError";
  }
}
