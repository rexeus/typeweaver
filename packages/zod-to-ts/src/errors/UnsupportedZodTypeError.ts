export const UNSUPPORTED_ZOD_TYPE_ERROR_CODE = "UNSUPPORTED_ZOD_TYPE";

export type UnsupportedZodTypeKind =
  | "lazy"
  | "template-literal"
  | "custom"
  | "transform";

export class UnsupportedZodTypeError extends Error {
  public override readonly name = "UnsupportedZodTypeError";
  public readonly code = UNSUPPORTED_ZOD_TYPE_ERROR_CODE;

  public constructor(
    public readonly schemaKind: UnsupportedZodTypeKind,
    public readonly reason: string
  ) {
    super(
      `[${UNSUPPORTED_ZOD_TYPE_ERROR_CODE}] Cannot convert Zod schema kind '${schemaKind}': ${reason}. Restructure the schema to a supported shape before generating TypeScript.`
    );
  }
}
