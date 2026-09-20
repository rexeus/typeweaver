import type {
  HttpHeaderSchemaLike,
  HttpQuerySchema,
} from "@rexeus/typeweaver-core";
import { z } from "zod";
import type { $ZodShape } from "zod/v4/core";

export type SchemaInfo = {
  readonly originalKey: string;
  readonly isArray: boolean;
};

const schemaCacheCaseSensitive = new WeakMap<
  $ZodShape,
  Map<string, SchemaInfo>
>();
const schemaCacheCaseInsensitive = new WeakMap<
  $ZodShape,
  Map<string, SchemaInfo>
>();

/**
 * Analyzes a Zod schema shape to create an efficient lookup map.
 * Results are cached using WeakMap for optimal performance.
 */
export function analyzeSchema(
  shape: $ZodShape,
  caseSensitive: boolean
): Map<string, SchemaInfo> {
  const cache = caseSensitive
    ? schemaCacheCaseSensitive
    : schemaCacheCaseInsensitive;

  const cached = cache.get(shape);
  if (cached) {
    return cached;
  }

  const schemaMap = buildSchemaMap(shape, caseSensitive);
  cache.set(shape, schemaMap);
  return schemaMap;
}

/**
 * Extracts a Zod schema shape from header or query schemas.
 * This is used to support schema coercion and analysis.
 */
export function getSchema(
  headerSchema: HttpHeaderSchemaLike | HttpQuerySchema
): $ZodShape {
  return getObjectSchema(headerSchema)?.shape ?? {};
}

export function getObjectSchema(
  schema: HttpHeaderSchemaLike | HttpQuerySchema
): z.ZodObject | undefined {
  if (schema instanceof z.ZodObject) {
    return schema;
  }
  if (schema instanceof z.ZodOptional) {
    const unwrapped = schema.unwrap();
    return unwrapped instanceof z.ZodObject ? unwrapped : undefined;
  }
  return undefined;
}

/**
 * Unwraps an optional container schema to a supported object or record.
 */
export function getContainerSchema(
  schema: HttpHeaderSchemaLike | HttpQuerySchema
): z.ZodObject | z.ZodRecord | undefined {
  const unwrapped = schema instanceof z.ZodOptional ? schema.unwrap() : schema;
  if (unwrapped instanceof z.ZodObject || unwrapped instanceof z.ZodRecord) {
    return unwrapped;
  }
  return undefined;
}

export function fieldExpectsArray(
  schema: HttpHeaderSchemaLike | HttpQuerySchema,
  key: string,
  caseSensitive: boolean
): boolean | undefined {
  const container = schema instanceof z.ZodOptional ? schema.unwrap() : schema;

  if (container instanceof z.ZodObject) {
    const lookupKey = caseSensitive ? key : key.toLowerCase();
    return analyzeSchema(container.shape, caseSensitive).get(lookupKey)
      ?.isArray;
  }

  if (container instanceof z.ZodRecord) {
    return isArraySchema(container.valueType);
  }

  return undefined;
}

export function isArraySchema(schema: z.core.$ZodType): boolean {
  return classifyArrayTransport(schema) === "array";
}

export function finiteStringOutputs(
  schema: z.core.$ZodType
): readonly string[] | undefined {
  if (schema instanceof z.ZodLiteral) {
    const values = [...schema.values];
    const strings = values.filter(
      (value): value is string => typeof value === "string"
    );
    return strings.length === values.length ? strings : undefined;
  }
  if (schema instanceof z.ZodEnum) {
    const strings = schema.options.filter(
      (value): value is string => typeof value === "string"
    );
    return strings.length === schema.options.length ? strings : undefined;
  }
  if (schema instanceof z.ZodUnion) {
    const outputs = schema.options.map(option => finiteStringOutputs(option));
    if (outputs.some(output => output === undefined)) return undefined;
    return outputs.flatMap(output => output ?? []);
  }
  return undefined;
}

/**
 * Builds a schema map by analyzing the Zod shape structure.
 * Extracts type information for each field to support proper coercion.
 */
function buildSchemaMap(
  shape: $ZodShape,
  caseSensitive: boolean
): Map<string, SchemaInfo> {
  const schemaMap = new Map<string, SchemaInfo>();
  for (const [key, zodType] of Object.entries(shape)) {
    if (!zodType) continue;

    const isArray = isArraySchema(zodType);

    const lookupKey = caseSensitive ? key : key.toLowerCase();
    schemaMap.set(lookupKey, { originalKey: key, isArray });
  }
  return schemaMap;
}

/**
 * Classifies a leaf schema's transport cardinality by unwrapping public Zod
 * wrappers the authoring boundary also accepts. The raw transport value feeds
 * a pipe's input side, so `ZodPipe.in` determines the shape to normalize.
 */
function classifyArrayTransport(schema: z.core.$ZodType): "array" | "scalar" {
  const unwrapped = unwrapCardinalityWrappers(schema);

  if (unwrapped instanceof z.ZodArray) {
    return "array";
  }
  if (unwrapped instanceof z.ZodPipe) {
    return classifyArrayTransport(unwrapped.in);
  }
  return "scalar";
}

function unwrapCardinalityWrappers(schema: z.core.$ZodType): z.core.$ZodType {
  let current = schema;
  let unwrapped = unwrapCardinalityWrapper(current);

  while (unwrapped !== undefined) {
    current = unwrapped;
    unwrapped = unwrapCardinalityWrapper(current);
  }

  return current;
}

function unwrapCardinalityWrapper(
  schema: z.core.$ZodType
): z.core.$ZodType | undefined {
  if (schema instanceof z.ZodOptional) return schema.unwrap();
  if (schema instanceof z.ZodExactOptional) return schema.unwrap();
  if (schema instanceof z.ZodDefault) return schema.unwrap();
  if (schema instanceof z.ZodCatch) return schema.unwrap();
  if (schema instanceof z.ZodReadonly) return schema.unwrap();
  if (schema instanceof z.ZodNonOptional) return schema.unwrap();
  if (schema instanceof z.ZodSuccess) return schema.unwrap();
  if (schema instanceof z.ZodPrefault) return schema.unwrap();
  return undefined;
}
