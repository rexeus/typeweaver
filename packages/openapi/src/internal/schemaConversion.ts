import { fromZod } from "@rexeus/typeweaver-zod-to-json-schema";
import type { JsonSchema } from "@rexeus/typeweaver-zod-to-json-schema";
import { z } from "zod";
import { appendJsonPointer } from "./jsonPointer.js";
import { normalizeOpenApiSchema } from "./openApiSchemaNormalization.js";
import {
  isJsonSchema,
  preserveReferencedRootDefinitionKeyword,
  rebaseJsonSchemaValue,
} from "./schemaDefinitionRefs.js";
import { getSchemaDefinition } from "./zodIntrospection.js";
import type {
  OpenApiSchemaConversionWarning,
  OpenApiWarningLocation,
} from "../types.js";

export type SchemaConversionResult = {
  readonly schema: JsonSchema;
  readonly warnings: readonly OpenApiSchemaConversionWarning[];
};
export type OptionalSchemaResult = {
  readonly schema: z.core.$ZodType;
  readonly isOptional: boolean;
};
export type ConvertSchemaOptions = { readonly rebaseLocalRefs?: boolean };
const ROOT_TRANSPARENT_WRAPPER_TYPES = new Set([
  "optional",
  "default",
  "catch",
  "prefault",
  "readonly",
  "nonoptional",
]);
export function convertSchema(
  schema: z.core.$ZodType,
  documentPath: string,
  location: OpenApiWarningLocation,
  options: ConvertSchemaOptions = {}
): SchemaConversionResult {
  const result = fromZod(schema);
  const openApiSchema = normalizeOpenApiSchema(result.schema);
  return {
    schema:
      (options.rebaseLocalRefs ?? true)
        ? rebaseLocalJsonSchemaRefs(openApiSchema, documentPath)
        : openApiSchema,
    warnings: result.warnings.map(warning => ({
      origin: "schema-conversion",
      code: warning.code,
      message: warning.message,
      schemaType: warning.schemaType,
      schemaPath: warning.path,
      documentPath: appendJsonPointer(documentPath, warning.path),
      location,
    })),
  };
}
export function rebaseLocalJsonSchemaRefs(
  schema: JsonSchema,
  documentPath: string
): JsonSchema {
  return rebaseJsonSchemaValue(schema, documentPath) as JsonSchema;
}
export function unwrapRootOptional(
  schema: z.core.$ZodType
): OptionalSchemaResult {
  return {
    schema: unwrapRootSchema(schema),
    isOptional: omittedInputResult(schema) !== "rejects",
  };
}
function unwrapRootSchema(schema: z.core.$ZodType): z.core.$ZodType {
  const visited = new Set<z.core.$ZodType>();
  let current = schema;
  while (!visited.has(current)) {
    visited.add(current);
    const definition = getSchemaDefinition(current);
    const schemaType = definition?.type;
    if (schemaType === "nullable") return current;
    if (
      schemaType !== undefined &&
      ROOT_TRANSPARENT_WRAPPER_TYPES.has(schemaType)
    ) {
      if (definition?.innerType === undefined) return current;
      current = definition.innerType;
      continue;
    }
    return current;
  }
  return current;
}
type OmittedInputResult = "rejects" | "accepts-defined" | "accepts-undefined";
type OmittedInputStep =
  | { readonly _tag: "Done"; readonly result: OmittedInputResult }
  | { readonly _tag: "Continue"; readonly schema: z.core.$ZodType };
type OmittedInputHandler = (
  innerType: z.core.$ZodType | undefined
) => OmittedInputStep;
const continueWithInner = (
  innerType: z.core.$ZodType | undefined
): OmittedInputStep =>
  innerType === undefined
    ? { _tag: "Done", result: "rejects" }
    : { _tag: "Continue", schema: innerType };
const omittedInputHandlers: Readonly<
  Partial<Record<string, OmittedInputHandler>>
> = {
  optional: () => ({ _tag: "Done", result: "accepts-undefined" }),
  default: () => ({ _tag: "Done", result: "accepts-defined" }),
  prefault: () => ({ _tag: "Done", result: "accepts-defined" }),
  catch: inner => ({
    _tag: "Done",
    result: catchInputResult(inner),
  }),
  nonoptional: inner => ({
    _tag: "Done",
    result:
      inner === undefined || omittedInputResult(inner) !== "accepts-defined"
        ? "rejects"
        : "accepts-defined",
  }),
  nullable: continueWithInner,
  readonly: continueWithInner,
};
function catchInputResult(
  innerType: z.core.$ZodType | undefined
): OmittedInputResult {
  if (innerType === undefined) return "accepts-defined";
  const innerResult = omittedInputResult(innerType);
  return innerResult === "rejects" ? "accepts-defined" : innerResult;
}
function omittedInputResult(schema: z.core.$ZodType): OmittedInputResult {
  const visited = new Set<z.core.$ZodType>();
  let current = schema;
  while (!visited.has(current)) {
    visited.add(current);
    const definition = getSchemaDefinition(current);
    if (definition?.type === undefined) return "rejects";
    const handler = omittedInputHandlers[definition.type];
    if (handler === undefined) return "rejects";
    const step = handler(definition.innerType);
    if (step._tag === "Done") return step.result;
    current = step.schema;
  }
  return "rejects";
}
export function getObjectProperties(
  schema: JsonSchema
): Record<string, JsonSchema> {
  const properties = schema["properties"];
  return !isJsonSchema(properties)
    ? {}
    : Object.fromEntries(
        Object.entries(properties).filter(
          (entry): entry is [string, JsonSchema] => isJsonSchema(entry[1])
        )
      );
}
export function preserveReferencedRootDefinitions(
  schema: JsonSchema,
  rootSchema: JsonSchema
): JsonSchema {
  return ["$defs", "definitions"].reduce(
    (current, definitionKey) =>
      preserveReferencedRootDefinitionKeyword({
        schema: current,
        sourceSchema: current,
        rootSchema,
        definitionKey,
      }),
    schema
  );
}
export function getRequiredNames(schema: JsonSchema): ReadonlySet<string> {
  return !Array.isArray(schema["required"])
    ? new Set()
    : new Set(
        schema["required"].filter(
          (entry): entry is string => typeof entry === "string"
        )
      );
}
export function hasUnrepresentableAdditionalProperties(
  schema: JsonSchema
): boolean {
  return (
    Object.hasOwn(schema, "additionalProperties") &&
    schema["additionalProperties"] !== false
  );
}
