export class EmptyZodLiteralError extends Error {
  public override readonly name = "EmptyZodLiteralError";

  public constructor() {
    super("ZodLiteral must contain at least one literal value.");
  }
}
