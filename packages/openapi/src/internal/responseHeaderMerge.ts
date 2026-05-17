import type {
  NormalizedResponse,
  NormalizedResponseUsage,
} from "@rexeus/typeweaver-gen";
import type {
  JsonSchema,
  JsonSchemaValue,
} from "@rexeus/typeweaver-zod-to-json-schema";
import { buildHeaderObjects } from "./headerObjects.js";
import { escapeJsonPointerSegment } from "./jsonPointer.js";
import {
  isWarningDocumentPathAtOrBelow,
  rebaseSchemaDocumentRefs,
  rebaseWarningDocumentPath,
} from "./schemaRebasing.js";
import type { OpenApiBuildWarning, OpenApiHeaderObject } from "../types.js";
import type { OperationContext } from "./operationContext.js";

export type ResponseHeaderMergeVariant = {
  readonly response: Pick<NormalizedResponse, "header">;
  readonly usage: Pick<NormalizedResponseUsage, "responseName">;
};

type VariantHeaders = {
  readonly responseName: string;
  readonly headers: Record<string, OpenApiHeaderObject>;
  readonly warnings: readonly OpenApiBuildWarning[];
};

type HeaderAppearance = {
  readonly variantIndex: number;
  readonly responseName: string;
  readonly header: OpenApiHeaderObject;
  readonly warnings: readonly OpenApiBuildWarning[];
  readonly schemaKey: string;
};

type MergedHeader = {
  readonly name: string;
  readonly header: OpenApiHeaderObject;
  readonly warnings: readonly OpenApiBuildWarning[];
};

export function buildMergedHeaders(
  variants: readonly ResponseHeaderMergeVariant[],
  options: {
    readonly context: OperationContext;
    readonly statusCode: string;
    readonly responsePointer: string;
  }
): {
  readonly headers: Record<string, OpenApiHeaderObject>;
  readonly warnings: readonly OpenApiBuildWarning[];
} {
  const variantHeaders = variants.map(variant =>
    buildVariantHeaders(variant, options)
  );
  const mergedHeaders = headerNamesFrom(variantHeaders).map(name =>
    mergeHeader(name, variantHeaders, options.responsePointer)
  );

  return {
    headers: Object.fromEntries(
      mergedHeaders.map(merged => [merged.name, merged.header])
    ),
    warnings: [
      ...warningsOutsideMergedHeaderSchemas(
        variantHeaders,
        options.responsePointer
      ),
      ...mergedHeaders.flatMap(merged => merged.warnings),
    ],
  };
}

function buildVariantHeaders(
  variant: ResponseHeaderMergeVariant,
  options: {
    readonly context: OperationContext;
    readonly statusCode: string;
    readonly responsePointer: string;
  }
): VariantHeaders {
  const built = buildHeaderObjects(variant.response.header, options.context, {
    responseName: variant.usage.responseName,
    statusCode: options.statusCode,
    part: "response.header",
    headersPointer: `${options.responsePointer}/headers`,
  });

  return {
    responseName: variant.usage.responseName,
    headers: built.headers,
    warnings: built.warnings,
  };
}

function warningsOutsideMergedHeaderSchemas(
  variants: readonly VariantHeaders[],
  responsePointer: string
): readonly OpenApiBuildWarning[] {
  return variants.flatMap(variant => {
    const headerSchemaPointers = Object.keys(variant.headers).map(name =>
      headerSchemaPointer(responsePointer, name)
    );

    return variant.warnings.filter(
      warning =>
        !headerSchemaPointers.some(pointer =>
          isWarningDocumentPathAtOrBelow(warning, pointer)
        )
    );
  });
}

function headerNamesFrom(
  variants: readonly VariantHeaders[]
): readonly string[] {
  const namesByLowercase = new Map<string, string>();

  for (const variant of variants) {
    for (const name of Object.keys(variant.headers)) {
      const lowercaseName = name.toLowerCase();

      if (!namesByLowercase.has(lowercaseName)) {
        namesByLowercase.set(lowercaseName, name);
      }
    }
  }

  return [...namesByLowercase.values()];
}

function mergeHeader(
  name: string,
  variants: readonly VariantHeaders[],
  responsePointer: string
): MergedHeader {
  const schemaPointer = headerSchemaPointer(responsePointer, name);
  const appearances = headerAppearancesFor(
    name,
    variants,
    responsePointer,
    schemaPointer
  );
  const distinctSchemaAppearances =
    distinctHeaderSchemaAppearances(appearances);
  const schema = mergedHeaderSchema(distinctSchemaAppearances, schemaPointer);
  const warnings = mergedHeaderSchemaWarnings({
    appearances,
    distinctSchemaAppearances,
    schemaPointer,
  });
  const description = mergedHeaderDescription(appearances);

  if (schema === undefined) {
    return {
      name,
      header: { required: false, schema: {} },
      warnings,
    };
  }

  return {
    name,
    header: {
      ...(description === undefined ? {} : { description }),
      required:
        variants.every((_, index) =>
          appearances.some(appearance => appearance.variantIndex === index)
        ) && appearances.every(appearance => appearance.header.required),
      schema,
    },
    warnings,
  };
}

function headerAppearancesFor(
  name: string,
  variants: readonly VariantHeaders[],
  responsePointer: string,
  schemaPointer: string
): readonly HeaderAppearance[] {
  return variants.flatMap((variant, variantIndex) => {
    const headerEntries = headerEntriesFor(variant.headers, name);

    if (headerEntries.length === 0) {
      return [];
    }

    return headerEntries.map(headerEntry => {
      const originalSchemaPointer = headerSchemaPointer(
        responsePointer,
        headerEntry.name
      );
      const warnings = variant.warnings
        .filter(warning =>
          isWarningDocumentPathAtOrBelow(warning, originalSchemaPointer)
        )
        .map(warning =>
          originalSchemaPointer === schemaPointer
            ? warning
            : rebaseWarningDocumentPath(
                warning,
                originalSchemaPointer,
                schemaPointer
              )
        );

      return {
        variantIndex,
        responseName: variant.responseName,
        header: headerEntry.header,
        warnings,
        schemaKey: stableStringifyJsonSchema(headerEntry.header.schema),
      };
    });
  });
}

function headerEntriesFor(
  headers: Record<string, OpenApiHeaderObject>,
  name: string
): readonly { readonly name: string; readonly header: OpenApiHeaderObject }[] {
  const lowerName = name.toLowerCase();
  const entries: {
    readonly name: string;
    readonly header: OpenApiHeaderObject;
  }[] = [];

  for (const [headerName, header] of Object.entries(headers)) {
    if (headerName.toLowerCase() === lowerName) {
      entries.push({ name: headerName, header });
    }
  }

  return entries;
}

function distinctHeaderSchemaAppearances(
  appearances: readonly HeaderAppearance[]
): readonly HeaderAppearance[] {
  const seenSchemas = new Set<string>();
  const distinctAppearances: HeaderAppearance[] = [];

  for (const appearance of appearances) {
    if (seenSchemas.has(appearance.schemaKey)) {
      continue;
    }

    seenSchemas.add(appearance.schemaKey);
    distinctAppearances.push(appearance);
  }

  return distinctAppearances;
}

function mergedHeaderSchema(
  appearances: readonly HeaderAppearance[],
  schemaPointer: string
): JsonSchema | undefined {
  const firstAppearance = appearances[0];

  if (firstAppearance === undefined) {
    return undefined;
  }

  if (appearances.length === 1) {
    return firstAppearance.header.schema;
  }

  return {
    anyOf: appearances.map((appearance, index) =>
      rebaseSchemaDocumentRefs(
        appearance.header.schema,
        schemaPointer,
        `${schemaPointer}/anyOf/${index}`
      )
    ),
  } as JsonSchema;
}

function mergedHeaderSchemaWarnings(options: {
  readonly appearances: readonly HeaderAppearance[];
  readonly distinctSchemaAppearances: readonly HeaderAppearance[];
  readonly schemaPointer: string;
}): readonly OpenApiBuildWarning[] {
  if (options.distinctSchemaAppearances.length <= 1) {
    return options.appearances.flatMap(appearance => appearance.warnings);
  }

  return options.appearances.flatMap(appearance => {
    const schemaIndex = options.distinctSchemaAppearances.findIndex(
      distinctAppearance =>
        distinctAppearance.schemaKey === appearance.schemaKey
    );
    const branchPointer = `${options.schemaPointer}/anyOf/${schemaIndex}`;

    return appearance.warnings.map(warning =>
      rebaseWarningDocumentPath(warning, options.schemaPointer, branchPointer)
    );
  });
}

function headerSchemaPointer(responsePointer: string, name: string): string {
  return `${responsePointer}/headers/${escapeJsonPointerSegment(name)}/schema`;
}

function mergedHeaderDescription(
  appearances: readonly HeaderAppearance[]
): string | undefined {
  const describedAppearances = appearances.filter(
    appearance => appearance.header.description !== undefined
  );
  const distinctDescriptions = new Set(
    describedAppearances.map(appearance => appearance.header.description)
  );

  if (distinctDescriptions.size === 0) {
    return undefined;
  }

  if (distinctDescriptions.size === 1) {
    return describedAppearances[0]?.header.description;
  }

  return [
    "Header description merged from response variants:",
    ...describedAppearances.map(
      appearance =>
        `- ${appearance.responseName}: ${appearance.header.description ?? ""}`
    ),
  ].join("\n");
}

/**
 * Canonical, deterministic JSON serialization for header schemas. Used to
 * deduplicate equivalent JSON schemas across response variants and (through
 * the lexicographic key sort) to produce byte-identical output across hosts
 * with different default locales — a Turkish locale, for example, sorts
 * dotted-`i` and dotless-`ı` differently from the ASCII byte order that the
 * golden-gate diff relies on.
 *
 * @internal Exposed for direct unit testing; not part of the public surface.
 */
export function stableStringifyJsonSchema(schema: JsonSchema): string {
  return JSON.stringify(canonicalizeJsonSchemaValue(schema));
}

function canonicalizeJsonSchemaValue(value: JsonSchemaValue): JsonSchemaValue {
  if (Array.isArray(value)) {
    return value.map(canonicalizeJsonSchemaValue);
  }

  if (!isJsonSchemaObject(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .sort(([leftKey], [rightKey]) =>
        leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0
      )
      .map(([key, child]) => [key, canonicalizeJsonSchemaValue(child)])
  ) as JsonSchema;
}

function isJsonSchemaObject(value: JsonSchemaValue): value is JsonSchema {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
