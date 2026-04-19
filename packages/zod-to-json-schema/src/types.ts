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
  readonly schemaType: string;
  readonly path: string;
  readonly message: string;
};

export type ZodToJsonSchemaResult = {
  readonly schema: JsonSchema;
  readonly warnings: readonly ZodToJsonSchemaWarning[];
};
