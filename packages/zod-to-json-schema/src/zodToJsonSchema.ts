import { z } from "zod";
import { normalizeJsonSchema } from "./internal/normalizeJsonSchema.js";
import type {
  JsonSchema,
  ZodToJsonSchemaResult,
  ZodToJsonSchemaWarning,
  ZodToJsonSchemaWarningCode,
} from "./types.js";
import type { $ZodType } from "zod/v4/core";

type ZodDef = {
  readonly type?: string;
  readonly shape?: Record<string, $ZodType>;
  readonly innerType?: $ZodType;
  readonly element?: $ZodType;
  readonly options?: readonly $ZodType[];
  readonly left?: $ZodType;
  readonly right?: $ZodType;
  readonly items?: readonly $ZodType[];
  readonly rest?: $ZodType;
  readonly keyType?: $ZodType;
  readonly valueType?: $ZodType;
  readonly checks?: readonly ZodCheck[];
  readonly in?: $ZodType;
  readonly out?: $ZodType;
  readonly getter?: () => $ZodType;
};

type ZodCheck = {
  readonly _zod?: {
    readonly def?: {
      readonly check?: string;
      readonly format?: string;
      readonly type?: string;
    };
  };
};

type WarningCollector = {
  readonly warnings: ZodToJsonSchemaWarning[];
  readonly seen: Set<$ZodType>;
};

const SUPPORTED_SCHEMA_TYPES = new Set([
  "string",
  "number",
  "boolean",
  "null",
  "object",
  "array",
  "enum",
  "literal",
  "union",
  "intersection",
  "tuple",
  "record",
  "optional",
  "nullable",
  "default",
  "lazy",
]);

const SUPPORTED_CHECKS = new Set([
  "greater_than",
  "less_than",
  "multiple_of",
  "number_format",
  "max_length",
  "min_length",
  "length_equals",
  "string_format",
  "regex",
  "overwrite",
  "mime_type",
  "size_equals",
  "max_size",
  "min_size",
  "property",
]);

const SUPPORTED_STRING_FORMATS = new Set([
  "regex",
  "email",
  "url",
  "uuid",
  "guid",
  "nanoid",
  "cuid",
  "cuid2",
  "ulid",
  "emoji",
  "jwt",
  "ipv4",
  "ipv6",
  "base64",
  "base64url",
  "e164",
  "date",
  "time",
  "datetime",
  "duration",
  "starts_with",
  "ends_with",
  "includes",
  "lowercase",
  "uppercase",
]);

export function fromZod(schema: $ZodType): ZodToJsonSchemaResult {
  const collector: WarningCollector = {
    warnings: [],
    seen: new Set(),
  };

  collectWarnings(schema, collector, []);

  try {
    const converted = z.toJSONSchema(schema as z.ZodType, {
      target: "draft-2020-12",
      unrepresentable: "any",
    }) as JsonSchema;

    return {
      schema: normalizeJsonSchema(stripRootSchemaDialect(converted)),
      warnings: collector.warnings,
    };
  } catch (error) {
    collector.warnings.push(
      createWarning({
        code: "conversion-error",
        schemaType: getSchemaType(schema),
        path: [],
        message:
          error instanceof Error
            ? error.message
            : "Failed to convert schema to JSON Schema.",
      })
    );

    return {
      schema: {},
      warnings: collector.warnings,
    };
  }
}

function collectWarnings(
  schema: $ZodType,
  collector: WarningCollector,
  path: readonly string[]
): void {
  if (!isZodType(schema)) {
    return;
  }

  if (collector.seen.has(schema)) {
    return;
  }

  collector.seen.add(schema);
  const def = schema._zod.def as ZodDef;
  const schemaType = def.type ?? "unknown";

  collectCheckWarnings(schema, collector, path);

  if (!SUPPORTED_SCHEMA_TYPES.has(schemaType)) {
    collector.warnings.push(
      createWarning({
        code: "unsupported-schema",
        schemaType,
        path,
        message: `Zod ${schemaType} falls back to a broader JSON Schema representation.`,
      })
    );
  }

  switch (schemaType) {
    case "object": {
      const shape = def.shape ?? {};

      for (const [key, value] of Object.entries(shape)) {
        collectWarnings(value, collector, [...path, key]);
      }
      return;
    }
    case "array": {
      if (isZodType(def.element)) {
        collectWarnings(def.element, collector, [...path, "[]"]);
      }
      return;
    }
    case "union": {
      for (const [index, option] of (def.options ?? []).entries()) {
        collectWarnings(option, collector, [...path, `option:${index}`]);
      }
      return;
    }
    case "intersection": {
      if (isZodType(def.left)) {
        collectWarnings(def.left, collector, [...path, "left"]);
      }
      if (isZodType(def.right)) {
        collectWarnings(def.right, collector, [...path, "right"]);
      }
      return;
    }
    case "tuple": {
      for (const [index, item] of (def.items ?? []).entries()) {
        collectWarnings(item, collector, [...path, `${index}`]);
      }
      if (isZodType(def.rest)) {
        collectWarnings(def.rest, collector, [...path, "rest"]);
      }
      return;
    }
    case "record": {
      if (isZodType(def.keyType)) {
        collectWarnings(def.keyType, collector, [...path, "<key>"]);
      }
      if (isZodType(def.valueType)) {
        collectWarnings(def.valueType, collector, [...path, "<value>"]);
      }
      return;
    }
    case "optional":
    case "nullable":
    case "default": {
      if (isZodType(def.innerType)) {
        collectWarnings(def.innerType, collector, path);
      }
      return;
    }
    case "lazy": {
      if (def.getter !== undefined) {
        collectWarnings(def.getter(), collector, path);
      }
      return;
    }
    case "pipe": {
      if (isZodType(def.in)) {
        collectWarnings(def.in, collector, [...path, "in"]);
      }
      if (isZodType(def.out)) {
        collectWarnings(def.out, collector, [...path, "out"]);
      }
      return;
    }
    case "catch":
    case "readonly":
    case "nonoptional": {
      if (isZodType(def.innerType)) {
        collectWarnings(def.innerType, collector, path);
      }
      return;
    }
    default:
      return;
  }
}

function collectCheckWarnings(
  schema: $ZodType,
  collector: WarningCollector,
  path: readonly string[]
): void {
  const def = schema._zod.def as ZodDef;

  for (const check of def.checks ?? []) {
    const checkDef = check._zod?.def;
    if (checkDef === undefined) {
      continue;
    }

    const checkType = checkDef.check ?? checkDef.type ?? "unknown";
    if (!SUPPORTED_CHECKS.has(checkType)) {
      collector.warnings.push(
        createWarning({
          code: "unsupported-check",
          schemaType: getSchemaType(schema),
          path,
          message: `Zod check ${checkType} is not fully representable in JSON Schema and may be broadened.`,
        })
      );
      continue;
    }

    if (
      checkType === "string_format" &&
      checkDef.format !== undefined &&
      !SUPPORTED_STRING_FORMATS.has(checkDef.format)
    ) {
      collector.warnings.push(
        createWarning({
          code: "unsupported-check",
          schemaType: getSchemaType(schema),
          path,
          message: `Zod string format ${checkDef.format} is not fully representable in JSON Schema and may be broadened.`,
        })
      );
    }
  }
}

function createWarning(params: {
  readonly code: ZodToJsonSchemaWarningCode;
  readonly schemaType: string;
  readonly path: readonly string[];
  readonly message: string;
}): ZodToJsonSchemaWarning {
  return {
    code: params.code,
    schemaType: params.schemaType,
    path: formatPath(params.path),
    message: params.message,
  };
}

function formatPath(path: readonly string[]): string {
  if (path.length === 0) {
    return "$";
  }

  return `$.${path.join(".")}`;
}

export function getSchemaType(schema: $ZodType): string {
  const def = schema._zod.def as ZodDef;
  return def.type ?? "unknown";
}

function stripRootSchemaDialect(schema: JsonSchema): JsonSchema {
  const { $schema: _schema, ...rest } = schema;
  return rest;
}

function isZodType(value: unknown): value is $ZodType {
  return (
    typeof value === "object" &&
    value !== null &&
    "_zod" in value &&
    typeof (value as { readonly _zod?: unknown })._zod === "object"
  );
}
