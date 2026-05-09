import { fromZod } from "@rexeus/typeweaver-zod-to-json-schema";
import type {
  JsonSchema,
  JsonSchemaValue,
} from "@rexeus/typeweaver-zod-to-json-schema";
import { z } from "zod";
import { appendJsonPointer, escapeJsonPointerSegment } from "./jsonPointer.js";
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

export type ConvertSchemaOptions = {
  readonly rebaseLocalRefs?: boolean;
};

export function convertSchema(
  schema: z.core.$ZodType,
  documentPath: string,
  location: OpenApiWarningLocation,
  options: ConvertSchemaOptions = {}
): SchemaConversionResult {
  const result = fromZod(schema);
  const shouldRebaseLocalRefs = options.rebaseLocalRefs ?? true;

  return {
    schema: shouldRebaseLocalRefs
      ? rebaseLocalJsonSchemaRefs(result.schema, documentPath)
      : result.schema,
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
  if (!isZodOptional(schema)) {
    return { schema, isOptional: false };
  }

  return { schema: schema.unwrap(), isOptional: true };
}

export function getObjectProperties(
  schema: JsonSchema
): Record<string, JsonSchema> {
  const properties = schema.properties;

  if (!isJsonSchema(properties)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(properties).filter((entry): entry is [string, JsonSchema] =>
      isJsonSchema(entry[1])
    )
  );
}

export function preserveReferencedRootDefinitions(
  schema: JsonSchema,
  rootSchema: JsonSchema
): JsonSchema {
  return ["$defs", "definitions"].reduce(
    (selfContainedSchema, definitionKey) =>
      preserveReferencedRootDefinitionKeyword({
        schema: selfContainedSchema,
        sourceSchema: selfContainedSchema,
        rootSchema,
        definitionKey,
      }),
    schema
  );
}

export function getRequiredNames(schema: JsonSchema): ReadonlySet<string> {
  if (!Array.isArray(schema.required)) {
    return new Set();
  }

  return new Set(
    schema.required.filter(
      (entry): entry is string => typeof entry === "string"
    )
  );
}

export function hasUnrepresentableAdditionalProperties(
  schema: JsonSchema
): boolean {
  return (
    Object.prototype.hasOwnProperty.call(schema, "additionalProperties") &&
    schema.additionalProperties !== false
  );
}

export function isJsonSchema(value: unknown): value is JsonSchema {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rebaseJsonSchemaValue(
  value: JsonSchemaValue,
  documentPath: string
): JsonSchemaValue {
  if (Array.isArray(value)) {
    return value.map(item => rebaseJsonSchemaValue(item, documentPath));
  }

  if (!isJsonSchema(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      key === "$ref" && typeof child === "string"
        ? rebaseLocalJsonSchemaRef(child, documentPath)
        : rebaseJsonSchemaValue(child, documentPath),
    ])
  ) as JsonSchema;
}

function rebaseLocalJsonSchemaRef(ref: string, documentPath: string): string {
  if (ref === "#") {
    return `#${documentPath}`;
  }

  if (ref.startsWith("#/")) {
    return `#${appendJsonPointer(documentPath, ref.slice(1))}`;
  }

  return ref;
}

function preserveReferencedRootDefinitionKeyword(options: {
  readonly schema: JsonSchema;
  readonly sourceSchema: JsonSchema;
  readonly rootSchema: JsonSchema;
  readonly definitionKey: string;
}): JsonSchema {
  const rootDefinitions = options.rootSchema[options.definitionKey];

  if (!isJsonSchema(rootDefinitions)) {
    return options.schema;
  }

  const referencedDefinitions = collectReferencedRootDefinitions({
    schema: options.sourceSchema,
    rootDefinitions,
    definitionKey: options.definitionKey,
  });

  if (Object.keys(referencedDefinitions).length === 0) {
    return options.schema;
  }

  const existingDefinitions = options.schema[options.definitionKey];

  return {
    ...options.schema,
    [options.definitionKey]: {
      ...(isJsonSchema(existingDefinitions) ? existingDefinitions : {}),
      ...referencedDefinitions,
    },
  };
}

function collectReferencedRootDefinitions(options: {
  readonly schema: JsonSchema;
  readonly rootDefinitions: JsonSchema;
  readonly definitionKey: string;
}): JsonSchema {
  const referencedNames = collectReferencedDefinitionNames(
    options.schema,
    options.definitionKey
  );
  const pendingNames = [...referencedNames];
  const copiedDefinitions: Record<string, JsonSchemaValue> = {};

  for (const name of pendingNames) {
    if (Object.prototype.hasOwnProperty.call(copiedDefinitions, name)) {
      continue;
    }

    const definition = options.rootDefinitions[name];

    if (definition === undefined) {
      continue;
    }

    copiedDefinitions[name] = definition;

    if (!isJsonSchema(definition)) {
      continue;
    }

    for (const transitiveName of collectReferencedDefinitionNames(
      definition,
      options.definitionKey
    )) {
      if (
        !Object.prototype.hasOwnProperty.call(copiedDefinitions, transitiveName)
      ) {
        pendingNames.push(transitiveName);
      }
    }
  }

  return copiedDefinitions;
}

function collectReferencedDefinitionNames(
  value: JsonSchemaValue,
  definitionKey: string
): ReadonlySet<string> {
  const names = new Set<string>();

  collectReferencedDefinitionNamesFromValue(value, definitionKey, names);

  return names;
}

function collectReferencedDefinitionNamesFromValue(
  value: JsonSchemaValue,
  definitionKey: string,
  names: Set<string>
): void {
  if (Array.isArray(value)) {
    value.forEach(item =>
      collectReferencedDefinitionNamesFromValue(item, definitionKey, names)
    );
    return;
  }

  if (!isJsonSchema(value)) {
    return;
  }

  Object.entries(value).forEach(([key, child]) => {
    if (key === "$ref" && typeof child === "string") {
      const definitionName = getReferencedRootDefinitionName(
        child,
        definitionKey
      );

      if (definitionName !== undefined) {
        names.add(definitionName);
      }

      return;
    }

    collectReferencedDefinitionNamesFromValue(child, definitionKey, names);
  });
}

function getReferencedRootDefinitionName(
  ref: string,
  definitionKey: string
): string | undefined {
  const prefix = `#/${escapeJsonPointerSegment(definitionKey)}/`;

  if (!ref.startsWith(prefix)) {
    return undefined;
  }

  const [encodedName] = ref.slice(prefix.length).split("/");

  if (encodedName === undefined || encodedName === "") {
    return undefined;
  }

  return unescapeJsonPointerSegment(encodedName);
}

function unescapeJsonPointerSegment(segment: string): string {
  return segment.replaceAll("~1", "/").replaceAll("~0", "~");
}

function isZodOptional(
  schema: z.core.$ZodType
): schema is z.ZodOptional<z.ZodType> {
  return schema instanceof z.ZodOptional;
}
