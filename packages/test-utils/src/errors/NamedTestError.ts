export class NamedTestError extends Error {
  public constructor(
    public override readonly name: string,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
  }
}
