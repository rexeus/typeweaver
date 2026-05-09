export type JsonSchema = {
  readonly [key: string]: JsonSchemaValue;
};

export type JsonSchemaValue =
  | JsonSchema
  | readonly JsonSchemaValue[]
  | string
  | number
  | boolean
  | null;

export type ZodToJsonSchemaWarningCode =
  | "unsupported-schema"
  | "unsupported-check"
  | "conversion-error";

export type ZodToJsonSchemaWarning = {
  readonly code: ZodToJsonSchemaWarningCode;
  /** Best-effort diagnostic source type from Zod internals. */
  readonly schemaType: string;
  /** JSON Pointer to the affected JSON Schema or Typeweaver extension location; root is "". */
  readonly path: string;
  readonly message: string;
};

export type ZodToJsonSchemaResult = {
  readonly schema: JsonSchema;
  readonly warnings: readonly ZodToJsonSchemaWarning[];
};
