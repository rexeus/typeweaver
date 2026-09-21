import { getSchemaType, getZodDef, isZodSchema } from "./zodIntrospection.js";
import type {
  ZodToJsonSchemaWarning,
  ZodToJsonSchemaWarningCode,
} from "../types.js";
import type { ZodDef, ZodSchema, ZodCheck } from "./zodIntrospection.js";
export type WarningCollector = {
  readonly warnings: ZodToJsonSchemaWarning[];
  readonly seen: WeakSet<ZodSchema>;
};
export type WarningInput = {
  readonly code: ZodToJsonSchemaWarningCode;
  readonly schemaType: string;
  readonly path: readonly string[];
  readonly message: string;
};
const SUPPORTED_SCHEMA_TYPES = new Set([
  "any",
  "array",
  "boolean",
  "catch",
  "default",
  "enum",
  "intersection",
  "lazy",
  "literal",
  "null",
  "nullable",
  "number",
  "object",
  "optional",
  "prefault",
  "record",
  "string",
  "tuple",
  "union",
  "unknown",
]);
const SUPPORTED_CHECKS = new Set([
  "greater_than",
  "length_equals",
  "less_than",
  "max_length",
  "max_size",
  "mime_type",
  "min_length",
  "min_size",
  "multiple_of",
  "number_format",
  "overwrite",
  "property",
  "regex",
  "size_equals",
  "string_format",
]);
const SUPPORTED_STRING_FORMATS = new Set([
  "base64",
  "base64url",
  "cuid",
  "cuid2",
  "date",
  "datetime",
  "duration",
  "e164",
  "email",
  "emoji",
  "ends_with",
  "guid",
  "includes",
  "ipv4",
  "ipv6",
  "jwt",
  "lowercase",
  "nanoid",
  "regex",
  "starts_with",
  "time",
  "ulid",
  "uppercase",
  "url",
  "uuid",
]);
export const createWarning = (input: WarningInput): ZodToJsonSchemaWarning => ({
  code: input.code,
  schemaType: input.schemaType,
  path: formatPath(input.path),
  message: input.message,
});
export function collectCheckWarnings(
  def: ZodDef,
  collector: WarningCollector,
  path: readonly string[],
  schemaType: string
): void {
  if (schemaType === "custom" || schemaType === "transform") return;
  for (const check of getChecks(def)) {
    const { checkType, format } = describeCheck(check);
    if (isSupportedCheck(checkType, format)) continue;
    collector.warnings.push(
      createWarning({
        code: "unsupported-check",
        schemaType,
        path,
        message: `Zod ${schemaType} check ${checkType} cannot be represented exactly in JSON Schema.`,
      })
    );
  }
}
const describeCheck = (
  check: ZodCheck
): { readonly checkType: string; readonly format: string | undefined } => {
  const checkDef = check._zod?.def;
  return {
    checkType: checkDef?.check ?? checkDef?.type ?? "unknown",
    format: checkDef?.format,
  };
};
const isSupportedCheck = (
  checkType: string,
  format: string | undefined
): boolean =>
  SUPPORTED_CHECKS.has(checkType) &&
  (checkType !== "string_format" ||
    format === undefined ||
    SUPPORTED_STRING_FORMATS.has(format));
export const collectUnsupportedSchemaWarning = (
  schemaType: string,
  collector: WarningCollector,
  path: readonly string[]
): void => {
  if (SUPPORTED_SCHEMA_TYPES.has(schemaType)) return;
  collector.warnings.push(
    createWarning({
      code: "unsupported-schema",
      schemaType,
      path,
      message: `Zod ${schemaType} falls back to a broader JSON Schema representation.`,
    })
  );
};
const getChecks = (def: ZodDef): readonly ZodCheck[] => [
  ...(def.check === undefined ? [] : [{ _zod: { def } }]),
  ...(def.checks ?? []),
];
const formatPath = (path: readonly string[]): string =>
  path.length === 0
    ? ""
    : `/${path.map(segment => segment.replaceAll("~", "~0").replaceAll("/", "~1")).join("/")}`;
export const collectSchemaRoot = (
  schema: ZodSchema,
  collector: WarningCollector,
  collectNested: (
    def: ZodDef,
    schemaType: string,
    collector: WarningCollector,
    path: readonly string[]
  ) => void,
  path: readonly string[]
): void => {
  if (!isZodSchema(schema) || collector.seen.has(schema)) return;
  collector.seen.add(schema);
  const def = getZodDef(schema);
  const schemaType = getSchemaType(schema);
  if (def === undefined) return;
  collectCheckWarnings(def, collector, path, schemaType);
  collectUnsupportedSchemaWarning(schemaType, collector, path);
  collectNested(def, schemaType, collector, path);
};
