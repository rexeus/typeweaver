export class UnsupportedLiteralValueError extends Error {
  public override readonly name = "UnsupportedLiteralValueError";

  public constructor(public readonly valueType: string) {
    super(`Unsupported Zod literal value type: ${valueType}.`);
  }
}
