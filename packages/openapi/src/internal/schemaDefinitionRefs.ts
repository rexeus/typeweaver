import type {
  JsonSchema,
  JsonSchemaValue,
} from "@rexeus/typeweaver-zod-to-json-schema";
import { appendJsonPointer, escapeJsonPointerSegment } from "./jsonPointer.js";

export const isJsonSchema = (value: unknown): value is JsonSchema =>
  typeof value === "object" && value !== null && !Array.isArray(value);
export const rebaseJsonSchemaValue = (
  value: JsonSchemaValue,
  documentPath: string
): JsonSchemaValue => {
  if (Array.isArray(value))
    return (value as readonly JsonSchemaValue[]).map(item =>
      rebaseJsonSchemaValue(item, documentPath)
    );
  if (!isJsonSchema(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      key === "$ref" && typeof child === "string"
        ? rebaseLocalJsonSchemaRef(child, documentPath)
        : rebaseJsonSchemaValue(child, documentPath),
    ])
  ) as JsonSchema;
};
const rebaseLocalJsonSchemaRef = (
  ref: string,
  documentPath: string
): string => {
  if (ref === "#") return `#${documentPath}`;
  if (ref.startsWith("#/"))
    return `#${appendJsonPointer(documentPath, ref.slice(1))}`;
  return ref;
};
export function preserveReferencedRootDefinitionKeyword(options: {
  readonly schema: JsonSchema;
  readonly sourceSchema: JsonSchema;
  readonly rootSchema: JsonSchema;
  readonly definitionKey: string;
}): JsonSchema {
  const rootDefinitions = options.rootSchema[options.definitionKey];
  if (!isJsonSchema(rootDefinitions)) return options.schema;
  const referencedDefinitions = collectReferencedRootDefinitions({
    schema: options.sourceSchema,
    rootDefinitions,
    definitionKey: options.definitionKey,
  });
  if (Object.keys(referencedDefinitions).length === 0) return options.schema;
  const existingDefinitions = options.schema[options.definitionKey];
  return {
    ...options.schema,
    [options.definitionKey]: {
      ...(isJsonSchema(existingDefinitions) ? existingDefinitions : {}),
      ...referencedDefinitions,
    },
  };
}
const collectReferencedRootDefinitions = (options: {
  readonly schema: JsonSchema;
  readonly rootDefinitions: JsonSchema;
  readonly definitionKey: string;
}): JsonSchema => {
  const pendingNames = [
    ...collectReferencedDefinitionNames(options.schema, options.definitionKey),
  ];
  const copiedDefinitions: Record<string, JsonSchemaValue> = {};
  for (const name of pendingNames) {
    if (Object.hasOwn(copiedDefinitions, name)) continue;
    const definition = options.rootDefinitions[name];
    if (definition === undefined) continue;
    copiedDefinitions[name] = definition;
    if (!isJsonSchema(definition)) continue;
    for (const transitiveName of collectReferencedDefinitionNames(
      definition,
      options.definitionKey
    ))
      if (!Object.hasOwn(copiedDefinitions, transitiveName))
        pendingNames.push(transitiveName);
  }
  return copiedDefinitions;
};
const collectReferencedDefinitionNames = (
  value: JsonSchemaValue,
  definitionKey: string
): ReadonlySet<string> => {
  const names = new Set<string>();
  collectReferencedDefinitionNamesFromValue(value, definitionKey, names);
  return names;
};
const collectReferencedDefinitionNamesFromValue = (
  value: JsonSchemaValue,
  definitionKey: string,
  names: Set<string>
): void => {
  if (Array.isArray(value)) {
    for (const item of value as readonly JsonSchemaValue[])
      collectReferencedDefinitionNamesFromValue(item, definitionKey, names);
    return;
  }
  if (!isJsonSchema(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (key === "$ref" && typeof child === "string") {
      const name = getReferencedRootDefinitionName(child, definitionKey);
      if (name !== undefined) names.add(name);
      continue;
    }
    collectReferencedDefinitionNamesFromValue(child, definitionKey, names);
  }
};
const getReferencedRootDefinitionName = (
  ref: string,
  definitionKey: string
): string | undefined => {
  const prefix = `#/${escapeJsonPointerSegment(definitionKey)}/`;
  if (!ref.startsWith(prefix)) return undefined;
  const [encodedName] = ref.slice(prefix.length).split("/");
  return encodedName === undefined || encodedName === ""
    ? undefined
    : unescapeJsonPointerSegment(encodedName);
};
const unescapeJsonPointerSegment = (segment: string): string =>
  segment.replaceAll("~1", "/").replaceAll("~0", "~");
