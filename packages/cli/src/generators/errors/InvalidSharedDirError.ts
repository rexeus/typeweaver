export class InvalidSharedDirError extends Error {
  public constructor(public readonly explanation: string) {
    super("Invalid shared dir");
  }
}
