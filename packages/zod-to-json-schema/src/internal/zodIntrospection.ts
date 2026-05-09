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
  readonly in?: ZodSchema;
  readonly out?: ZodSchema;
  readonly getter?: () => ZodSchema;
};

export type ZodCheck = {
  readonly _zod?: {
    readonly def?: {
      readonly type?: string;
      readonly check?: string;
      readonly format?: string;
    };
  };
};

export function getZodDef(schema: ZodSchema): ZodDef | undefined {
  return schema._zod?.def as ZodDef | undefined;
}

export function getSchemaType(schema: ZodSchema): string {
  return getZodDef(schema)?.type ?? "unknown";
}

export function isZodSchema(value: unknown): value is ZodSchema {
  return (
    typeof value === "object" &&
    value !== null &&
    "_zod" in value &&
    typeof (value as { readonly _zod?: unknown })._zod === "object"
  );
}
