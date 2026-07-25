import {
  getSchemaType,
  getZodDef,
  isZodSchema,
  isZodTransparentWrapperType,
} from "./zodIntrospection.js";
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

type CheckDescriptor = {
  readonly checkType: string;
  readonly format: string | undefined;
};

type ChildSchemaField =
  | "element"
  | "in"
  | "keyType"
  | "left"
  | "out"
  | "right"
  | "valueType";

type ChildTraversal = {
  readonly field: ChildSchemaField;
  readonly path: readonly string[];
};

type NestedWarningPlan =
  | { readonly kind: "children"; readonly children: readonly ChildTraversal[] }
  | { readonly kind: "lazy" }
  | { readonly kind: "object" }
  | { readonly kind: "options"; readonly keyword: "anyOf" }
  | { readonly kind: "tuple" };

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
  "prefault",
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

const NESTED_WARNING_PLANS: ReadonlyMap<string, NestedWarningPlan> = new Map([
  ["object", { kind: "object" }],
  [
    "array",
    {
      kind: "children",
      children: [{ field: "element", path: ["items"] }],
    },
  ],
  ["union", { kind: "options", keyword: "anyOf" }],
  [
    "intersection",
    {
      kind: "children",
      children: [
        { field: "left", path: ["allOf", "0"] },
        { field: "right", path: ["allOf", "1"] },
      ],
    },
  ],
  ["tuple", { kind: "tuple" }],
  [
    "record",
    {
      kind: "children",
      children: [
        { field: "keyType", path: ["propertyNames"] },
        { field: "valueType", path: ["additionalProperties"] },
      ],
    },
  ],
  ["lazy", { kind: "lazy" }],
  [
    "pipe",
    {
      kind: "children",
      children: [
        { field: "in", path: ["x-typeweaver", "pipeIn"] },
        { field: "out", path: ["x-typeweaver", "pipeOut"] },
      ],
    },
  ],
  [
    "map",
    {
      kind: "children",
      children: [
        { field: "keyType", path: ["x-typeweaver", "mapKey"] },
        { field: "valueType", path: ["x-typeweaver", "mapValue"] },
      ],
    },
  ],
  [
    "set",
    {
      kind: "children",
      children: [{ field: "valueType", path: ["items"] }],
    },
  ],
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
    const { checkType, format } = describeCheck(check);

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

function describeCheck(check: ZodCheck): CheckDescriptor {
  const checkDef = check._zod?.def;

  return {
    checkType: checkDef?.check ?? checkDef?.type ?? "unknown",
    format: checkDef?.format,
  };
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
  const plan = NESTED_WARNING_PLANS.get(schemaType);

  if (plan !== undefined) {
    collectPlannedNestedWarnings(plan, def, collector, path);
    return;
  }

  if (isZodTransparentWrapperType(schemaType)) {
    collectChild(def.innerType, collector, path);
  }
}

function collectPlannedNestedWarnings(
  plan: NestedWarningPlan,
  def: ZodDef,
  collector: WarningCollector,
  path: readonly string[]
): void {
  switch (plan.kind) {
    case "object":
      collectObjectWarnings(def, collector, path);
      return;
    case "options":
      collectOptionWarnings(def.options, collector, path, plan.keyword);
      return;
    case "tuple":
      collectTupleWarnings(def, collector, path);
      return;
    case "lazy":
      collectLazyWarnings(def, collector, path);
      return;
    case "children":
      collectPlannedChildren(plan.children, def, collector, path);
      return;
  }
}

function collectPlannedChildren(
  children: readonly ChildTraversal[],
  def: ZodDef,
  collector: WarningCollector,
  path: readonly string[]
): void {
  for (const child of children) {
    collectChild(def[child.field], collector, [...path, ...child.path]);
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
  } catch (error) {
    collector.warnings.push(
      createWarning({
        code: "conversion-error",
        schemaType: "lazy",
        path,
        message:
          error instanceof Error
            ? error.message
            : "Failed to convert schema to JSON Schema.",
      })
    );
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
