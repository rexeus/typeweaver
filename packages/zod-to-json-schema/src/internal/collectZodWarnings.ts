import { getSchemaType, getZodDef, isZodSchema } from "./zodIntrospection.js";
import type {
  ZodToJsonSchemaWarning,
  ZodToJsonSchemaWarningCode,
} from "../types.js";
import type { ZodDef, ZodSchema, ZodCheck } from "./zodIntrospection.js";

type WarningCollector = {
  readonly warnings: ZodToJsonSchemaWarning[];
  readonly seen: WeakSet<ZodSchema>;
};

type WarningInput = {
  readonly code: ZodToJsonSchemaWarningCode;
  readonly schemaType: string;
  readonly path: readonly string[];
  readonly message: string;
};

const SUPPORTED_SCHEMA_TYPES: ReadonlySet<string> = new Set([
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
  "record",
  "string",
  "tuple",
  "union",
  "unknown",
]);

const SUPPORTED_CHECKS: ReadonlySet<string> = new Set([
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

const SUPPORTED_STRING_FORMATS: ReadonlySet<string> = new Set([
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

export function collectZodWarnings(
  schema: ZodSchema
): readonly ZodToJsonSchemaWarning[] {
  const collector: WarningCollector = {
    warnings: [],
    seen: new WeakSet(),
  };

  collectWarnings(schema, collector, []);

  return collector.warnings;
}

export function createWarning(input: WarningInput): ZodToJsonSchemaWarning {
  return {
    code: input.code,
    schemaType: input.schemaType,
    path: formatPath(input.path),
    message: input.message,
  };
}

function collectWarnings(
  schema: ZodSchema,
  collector: WarningCollector,
  path: readonly string[]
): void {
  if (!isZodSchema(schema) || collector.seen.has(schema)) {
    return;
  }

  collector.seen.add(schema);

  const def = getZodDef(schema);
  const schemaType = getSchemaType(schema);

  if (def === undefined) {
    return;
  }

  collectCheckWarnings(def, collector, path, schemaType);
  collectUnsupportedSchemaWarning(schemaType, collector, path);
  collectNestedWarnings(def, schemaType, collector, path);
}

function collectCheckWarnings(
  def: ZodDef,
  collector: WarningCollector,
  path: readonly string[],
  schemaType: string
): void {
  if (schemaType === "custom" || schemaType === "transform") {
    return;
  }

  for (const check of getChecks(def)) {
    const checkDef = check._zod?.def;
    const checkType = checkDef?.check ?? checkDef?.type ?? "unknown";
    const format = checkDef?.format;

    if (isSupportedCheck(checkType, format)) {
      continue;
    }

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

function isSupportedCheck(
  checkType: string,
  format: string | undefined
): boolean {
  if (!SUPPORTED_CHECKS.has(checkType)) {
    return false;
  }

  return (
    checkType !== "string_format" ||
    format === undefined ||
    SUPPORTED_STRING_FORMATS.has(format)
  );
}

function getChecks(def: ZodDef): readonly ZodCheck[] {
  const ownCheck = def.check === undefined ? [] : [{ _zod: { def } }];

  return [...ownCheck, ...(def.checks ?? [])];
}

function collectUnsupportedSchemaWarning(
  schemaType: string,
  collector: WarningCollector,
  path: readonly string[]
): void {
  if (SUPPORTED_SCHEMA_TYPES.has(schemaType)) {
    return;
  }

  collector.warnings.push(
    createWarning({
      code: "unsupported-schema",
      schemaType,
      path,
      message: `Zod ${schemaType} falls back to a broader JSON Schema representation.`,
    })
  );
}

function collectNestedWarnings(
  def: ZodDef,
  schemaType: string,
  collector: WarningCollector,
  path: readonly string[]
): void {
  switch (schemaType) {
    case "object":
      collectObjectWarnings(def, collector, path);
      return;
    case "array":
      collectChild(def.element, collector, [...path, "items"]);
      return;
    case "union":
      collectOptionWarnings(def.options, collector, path, "anyOf");
      return;
    case "intersection":
      collectChild(def.left, collector, [...path, "allOf", "0"]);
      collectChild(def.right, collector, [...path, "allOf", "1"]);
      return;
    case "tuple":
      collectTupleWarnings(def, collector, path);
      return;
    case "record":
      collectChild(def.keyType, collector, [...path, "propertyNames"]);
      collectChild(def.valueType, collector, [...path, "additionalProperties"]);
      return;
    case "optional":
    case "nullable":
    case "default":
    case "catch":
    case "readonly":
    case "nonoptional":
      collectChild(def.innerType, collector, path);
      return;
    case "lazy":
      collectLazyWarnings(def, collector, path);
      return;
    case "pipe":
      collectChild(def.in, collector, [...path, "x-typeweaver", "pipeIn"]);
      collectChild(def.out, collector, [...path, "x-typeweaver", "pipeOut"]);
      return;
    case "map":
      collectChild(def.keyType, collector, [...path, "x-typeweaver", "mapKey"]);
      collectChild(def.valueType, collector, [...path, "x-typeweaver", "mapValue"]);
      return;
    case "set":
      collectChild(def.valueType, collector, [...path, "items"]);
      return;
  }
}

function collectObjectWarnings(
  def: ZodDef,
  collector: WarningCollector,
  path: readonly string[]
): void {
  for (const [key, value] of Object.entries(def.shape ?? {})) {
    collectChild(value, collector, [...path, "properties", key]);
  }

  collectChild(def.catchall, collector, [...path, "additionalProperties"]);
}

function collectOptionWarnings(
  options: readonly ZodSchema[] | undefined,
  collector: WarningCollector,
  path: readonly string[],
  keyword: string
): void {
  for (const [index, option] of (options ?? []).entries()) {
    collectChild(option, collector, [...path, keyword, String(index)]);
  }
}

function collectTupleWarnings(
  def: ZodDef,
  collector: WarningCollector,
  path: readonly string[]
): void {
  for (const [index, item] of (def.items ?? []).entries()) {
    collectChild(item, collector, [...path, "prefixItems", String(index)]);
  }

  collectChild(def.rest, collector, [...path, "items"]);
}

function collectLazyWarnings(
  def: ZodDef,
  collector: WarningCollector,
  path: readonly string[]
): void {
  try {
    collectChild(def.getter?.(), collector, path);
  } catch {
    return;
  }
}

function collectChild(
  value: unknown,
  collector: WarningCollector,
  path: readonly string[]
): void {
  if (isZodSchema(value)) {
    collectWarnings(value, collector, path);
  }
}

function formatPath(path: readonly string[]): string {
  if (path.length === 0) {
    return "";
  }

  return `/${path.map(encodeJsonPointerSegment).join("/")}`;
}

function encodeJsonPointerSegment(segment: string): string {
  return segment.replaceAll("~", "~0").replaceAll("/", "~1");
}
