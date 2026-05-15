import type { z } from "zod";

export type ZodSchema = z.core.$ZodType;

export type ZodDef = {
  readonly type?: string;
  readonly check?: string;
  readonly format?: string;
  readonly checks?: readonly ZodCheck[];
  readonly shape?: Readonly<Record<string, ZodSchema>>;
  readonly catchall?: ZodSchema;
  readonly innerType?: ZodSchema;
  readonly element?: ZodSchema;
  readonly options?: readonly ZodSchema[];
  readonly left?: ZodSchema;
  readonly right?: ZodSchema;
  readonly items?: readonly ZodSchema[];
  readonly rest?: ZodSchema | null;
  readonly keyType?: ZodSchema;
  readonly valueType?: ZodSchema;
  readonly schema?: ZodSchema;
  readonly in?: ZodSchema;
  readonly out?: ZodSchema;
  readonly getter?: () => ZodSchema;
};

export type ZodTransparentWrapperType =
  | "optional"
  | "nullable"
  | "default"
  | "catch"
  | "prefault"
  | "readonly"
  | "nonoptional";

export type ZodCheck = {
  readonly _zod?: {
    readonly def?: {
      readonly type?: string;
      readonly check?: string;
      readonly format?: string;
    };
  };
};

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
): ZodDef | undefined {
  if (schema === undefined) {
    return undefined;
  }

  const schemaWithDefinition = schema as ZodSchema & {
    readonly def?: ZodDef;
    readonly _def?: ZodDef;
  };

  return (
    (schemaWithDefinition._zod?.def as ZodDef | undefined) ??
    schemaWithDefinition.def ??
    schemaWithDefinition._def
  );
}

export function getZodDef(schema: ZodSchema): ZodDef | undefined {
  return getSchemaDefinition(schema);
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

export function isZodSchema(value: unknown): value is ZodSchema {
  if (typeof value !== "object" || value === null || !("_zod" in value)) {
    return false;
  }

  const zodMetadata = (value as { readonly _zod?: unknown })._zod;

  return (
    typeof zodMetadata === "object" &&
    zodMetadata !== null &&
    "def" in zodMetadata &&
    typeof (zodMetadata as { readonly def?: unknown }).def === "object" &&
    (zodMetadata as { readonly def?: unknown }).def !== null
  );
}
