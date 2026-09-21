import type {
  NormalizedResponse,
  NormalizedResponseUsage,
} from "@rexeus/typeweaver-gen";
import type { JsonSchema } from "@rexeus/typeweaver-zod-to-json-schema";
import { buildHeaderObjects } from "./headerObjects.js";
import {
  headerSchemaPointer,
  mergedHeaderDescription,
  mergedHeaderSchemaWarnings,
  headerNamesFrom,
  stableStringifyJsonSchema,
  warningsOutsideMergedHeaderSchemas,
} from "./responseHeaderMergeHelpers.js";
import {
  isWarningDocumentPathAtOrBelow,
  rebaseSchemaDocumentRefs,
  rebaseWarningDocumentPath,
} from "./schemaRebasing.js";
import type { OpenApiBuildWarning, OpenApiHeaderObject } from "../types.js";
import type { OperationContext } from "./operationContext.js";
import type {
  HeaderAppearance,
  VariantHeaders,
} from "./responseHeaderMergeHelpers.js";
export { stableStringifyJsonSchema };

export type ResponseHeaderMergeVariant = {
  readonly response: Pick<NormalizedResponse, "header">;
  readonly usage: Pick<NormalizedResponseUsage, "responseName">;
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
