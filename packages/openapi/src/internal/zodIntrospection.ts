import type { z } from "zod";

export type ZodSchema = z.core.$ZodType;

export type ZodDefinition = {
  readonly type?: string;
  readonly innerType?: ZodSchema;
  readonly out?: ZodSchema;
  readonly schema?: ZodSchema;
};

export type ZodTransparentWrapperType =
  | "optional"
  | "nullable"
  | "default"
  | "catch"
  | "prefault"
  | "readonly"
  | "nonoptional";

const TRANSPARENT_WRAPPER_TYPES: ReadonlySet<string> = new Set([
  "optional",
  "nullable",
  "default",
  "catch",
  "prefault",
  "readonly",
  "nonoptional",
]);

export function getSchemaDefinition(
  schema: ZodSchema | undefined
): ZodDefinition | undefined {
  if (schema === undefined) {
    return undefined;
  }

  const schemaWithDefinition = schema as ZodSchema & {
    readonly def?: ZodDefinition;
    readonly _def?: ZodDefinition;
  };

  return (
    (schemaWithDefinition._zod?.def as ZodDefinition | undefined) ??
    schemaWithDefinition.def ??
    schemaWithDefinition._def
  );
}

export function getSchemaType(schema: ZodSchema): string;
export function getSchemaType(
  schema: ZodSchema | undefined
): string | undefined;
export function getSchemaType(
  schema: ZodSchema | undefined
): string | undefined {
  if (schema === undefined) {
    return undefined;
  }

  return getSchemaDefinition(schema)?.type ?? "unknown";
}

export function isZodTransparentWrapperType(
  schemaType: string | undefined,
  transparentWrapperTypes: ReadonlySet<string> = TRANSPARENT_WRAPPER_TYPES
): schemaType is ZodTransparentWrapperType {
  return schemaType !== undefined && transparentWrapperTypes.has(schemaType);
}
