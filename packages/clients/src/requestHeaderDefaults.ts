import type { NormalizedRequest } from "@rexeus/typeweaver-gen";
import type { ZodObject, ZodType } from "zod";

export type RequestHeaderDefaultEntry = {
  readonly key: string;
  readonly value: string;
};

export type RequestHeaderDefaults = {
  readonly entries: readonly RequestHeaderDefaultEntry[];
  readonly optionalHeaderKeys: readonly string[];
  readonly isHeaderInputOptional: boolean;
};

type ZodObjectWithShape = ZodObject<Record<string, ZodType>> & {
  readonly shape: Record<string, ZodType>;
};

function getSchemaType(schema: ZodType): string | undefined {
  return schema.def?.type ?? schema._def?.type;
}

function isZodObject(schema: ZodType): schema is ZodObjectWithShape {
  return getSchemaType(schema) === "object" && "shape" in schema;
}

function getStringLiteralValue(schema: ZodType): string | undefined {
  if (getSchemaType(schema) !== "literal") return undefined;

  const literalSchema = schema as { readonly values?: ReadonlySet<unknown> };
  if (literalSchema.values?.size !== 1) return undefined;

  const [value] = literalSchema.values;
  return typeof value === "string" ? value : undefined;
}

function isRequiredSchema(schema: ZodType): boolean {
  return !schema.isOptional();
}

export function getRequestHeaderDefaults(
  request: NormalizedRequest | undefined
): RequestHeaderDefaults | undefined {
  const header = request?.header;
  if (!header || !isZodObject(header)) return undefined;

  const entries = Object.entries(header.shape)
    .flatMap(([key, schema]) => {
      const value = getStringLiteralValue(schema);
      return value === undefined ? [] : [{ key, value }];
    })
    .sort((a, b) => a.key.localeCompare(b.key));

  if (entries.length === 0) return undefined;

  const defaultedHeaderKeys = new Set(entries.map(entry => entry.key));
  const requiredHeaderKeys = Object.entries(header.shape)
    .filter(([, schema]) => isRequiredSchema(schema))
    .map(([key]) => key);

  return {
    entries,
    optionalHeaderKeys: entries.map(entry => entry.key),
    isHeaderInputOptional: requiredHeaderKeys.every(key =>
      defaultedHeaderKeys.has(key)
    ),
  };
}
