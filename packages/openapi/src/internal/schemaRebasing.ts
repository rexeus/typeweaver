import type {
  JsonSchema,
  JsonSchemaValue,
} from "@rexeus/typeweaver-zod-to-json-schema";
import { isJsonPointerAtOrBelow } from "./jsonPointer.js";
import { isJsonSchema } from "./schemaDefinitionRefs.js";
import type { OpenApiBuildWarning } from "../types.js";

export function rebaseSchemaDocumentRefs(
  schema: JsonSchema,
  fromPointer: string,
  toPointer: string
): JsonSchema {
  return Object.fromEntries(
    Object.entries(schema).map(([key, child]): [string, JsonSchemaValue] => [
      key,
      key === "$ref" && typeof child === "string"
        ? rebaseDocumentRef(child, fromPointer, toPointer)
        : rebaseSchemaValueDocumentRefs(child, fromPointer, toPointer),
    ])
  );
}

export function rebaseWarningDocumentPath(
  warning: OpenApiBuildWarning,
  fromPointer: string,
  toPointer: string
): OpenApiBuildWarning {
  if (
    warning.origin !== "schema-conversion" ||
    !isJsonPointerAtOrBelow(warning.documentPath, fromPointer)
  ) {
    return warning;
  }

  return {
    ...warning,
    documentPath: `${toPointer}${warning.documentPath.slice(
      fromPointer.length
    )}`,
  };
}

export function isWarningDocumentPathAtOrBelow(
  warning: OpenApiBuildWarning,
  pointer: string
): boolean {
  return isJsonPointerAtOrBelow(warning.documentPath, pointer);
}

function rebaseSchemaValueDocumentRefs(
  value: JsonSchemaValue,
  fromPointer: string,
  toPointer: string
): JsonSchemaValue {
  if (Array.isArray(value)) {
    return (value as readonly JsonSchemaValue[]).map(item =>
      rebaseSchemaValueDocumentRefs(item, fromPointer, toPointer)
    );
  }

  if (!isJsonSchema(value)) {
    return value;
  }

  return rebaseSchemaDocumentRefs(value, fromPointer, toPointer);
}

function rebaseDocumentRef(
  ref: string,
  fromPointer: string,
  toPointer: string
): string {
  if (!ref.startsWith("#")) {
    return ref;
  }

  const documentPath = ref.slice(1);

  if (!isJsonPointerAtOrBelow(documentPath, fromPointer)) {
    return ref;
  }

  return `#${toPointer}${documentPath.slice(fromPointer.length)}`;
}
