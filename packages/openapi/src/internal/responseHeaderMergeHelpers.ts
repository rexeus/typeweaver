import type {
  JsonSchema,
  JsonSchemaValue,
} from "@rexeus/typeweaver-zod-to-json-schema";
import { escapeJsonPointerSegment } from "./jsonPointer.js";
import {
  isWarningDocumentPathAtOrBelow,
  rebaseWarningDocumentPath,
} from "./schemaRebasing.js";
import type { OpenApiBuildWarning, OpenApiHeaderObject } from "../types.js";

export type VariantHeaders = {
  readonly responseName: string;
  readonly headers: Record<string, OpenApiHeaderObject>;
  readonly warnings: readonly OpenApiBuildWarning[];
};
export type HeaderAppearance = {
  readonly variantIndex: number;
  readonly responseName: string;
  readonly header: OpenApiHeaderObject;
  readonly warnings: readonly OpenApiBuildWarning[];
  readonly schemaKey: string;
};
export const headerSchemaPointer = (
  responsePointer: string,
  name: string
): string =>
  `${responsePointer}/headers/${escapeJsonPointerSegment(name)}/schema`;
export function headerNamesFrom(
  variants: readonly VariantHeaders[]
): readonly string[] {
  const namesByLowercase = new Map<string, string>();
  for (const variant of variants) {
    for (const name of Object.keys(variant.headers)) {
      const lowercaseName = name.toLowerCase();
      if (!namesByLowercase.has(lowercaseName))
        namesByLowercase.set(lowercaseName, name);
    }
  }
  return [...namesByLowercase.values()];
}
export function warningsOutsideMergedHeaderSchemas(
  variants: readonly VariantHeaders[],
  responsePointer: string
): readonly OpenApiBuildWarning[] {
  return variants.flatMap(variant => {
    const pointers = Object.keys(variant.headers).map(name =>
      headerSchemaPointer(responsePointer, name)
    );
    return variant.warnings.filter(
      warning =>
        !pointers.some(pointer =>
          isWarningDocumentPathAtOrBelow(warning, pointer)
        )
    );
  });
}
export function mergedHeaderSchemaWarnings(options: {
  readonly appearances: readonly HeaderAppearance[];
  readonly distinctSchemaAppearances: readonly HeaderAppearance[];
  readonly schemaPointer: string;
}): readonly OpenApiBuildWarning[] {
  if (options.distinctSchemaAppearances.length <= 1)
    return options.appearances.flatMap(appearance => appearance.warnings);
  return options.appearances.flatMap(appearance => {
    const schemaIndex = options.distinctSchemaAppearances.findIndex(
      item => item.schemaKey === appearance.schemaKey
    );
    const branchPointer = `${options.schemaPointer}/anyOf/${schemaIndex}`;
    return appearance.warnings.map(warning =>
      rebaseWarningDocumentPath(warning, options.schemaPointer, branchPointer)
    );
  });
}
export function mergedHeaderDescription(
  appearances: readonly HeaderAppearance[]
): string | undefined {
  const described = appearances.filter(
    appearance => appearance.header.description !== undefined
  );
  const descriptions = new Set(
    described.map(appearance => appearance.header.description)
  );
  if (descriptions.size === 0) return undefined;
  if (descriptions.size === 1) return described[0]?.header.description;
  return [
    "Header description merged from response variants:",
    ...described.map(
      appearance =>
        `- ${appearance.responseName}: ${appearance.header.description ?? ""}`
    ),
  ].join("\n");
}
export function stableStringifyJsonSchema(schema: JsonSchema): string {
  return JSON.stringify(canonicalizeJsonSchemaValue(schema));
}
const canonicalizeJsonSchemaValue = (
  value: JsonSchemaValue
): JsonSchemaValue => {
  if (Array.isArray(value)) return value.map(canonicalizeJsonSchemaValue);
  if (!isJsonSchemaObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, child]) => [key, canonicalizeJsonSchemaValue(child)])
  ) as JsonSchema;
};
const isJsonSchemaObject = (value: JsonSchemaValue): value is JsonSchema =>
  typeof value === "object" && value !== null && !Array.isArray(value);
