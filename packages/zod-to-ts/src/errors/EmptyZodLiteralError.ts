export class EmptyZodLiteralError extends Error {
  public override readonly name = "EmptyZodLiteralError";

  public constructor(public readonly schemaKind: "ZodLiteral") {
    super(`${schemaKind} must contain at least one literal value.`);
  }
}
