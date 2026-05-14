import type {
  JsonSchema,
  JsonSchemaValue,
} from "@rexeus/typeweaver-zod-to-json-schema";
import { isJsonPointerAtOrBelow } from "./jsonPointer.js";
import type { OpenApiBuildWarning } from "../types.js";

export function rebaseSchemaDocumentRefs(
  schema: JsonSchema,
  fromPointer: string,
  toPointer: string
): JsonSchema {
  return rebaseSchemaValueDocumentRefs(
    schema,
    fromPointer,
    toPointer
  ) as JsonSchema;
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
    return value.map(item =>
      rebaseSchemaValueDocumentRefs(item, fromPointer, toPointer)
    );
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      key === "$ref" && typeof child === "string"
        ? rebaseDocumentRef(child, fromPointer, toPointer)
        : rebaseSchemaValueDocumentRefs(child, fromPointer, toPointer),
    ])
  ) as JsonSchema;
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
