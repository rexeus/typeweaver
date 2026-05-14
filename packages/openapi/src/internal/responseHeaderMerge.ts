import type {
  NormalizedResponse,
  NormalizedResponseUsage,
} from "@rexeus/typeweaver-gen";
import type { JsonSchema } from "@rexeus/typeweaver-zod-to-json-schema";
import { buildHeaderObjects } from "./headerObjects.js";
import { escapeJsonPointerSegment } from "./jsonPointer.js";
import type { OperationContext } from "./operationContext.js";
import {
  isWarningDocumentPathAtOrBelow,
  rebaseSchemaDocumentRefs,
  rebaseWarningDocumentPath,
} from "./schemaRebasing.js";
import type { OpenApiBuildWarning, OpenApiHeaderObject } from "../types.js";

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
  const names = new Set<string>();

  for (const variant of variants) {
    for (const name of Object.keys(variant.headers)) {
      names.add(name);
    }
  }

  return [...names];
}

function mergeHeader(
  name: string,
  variants: readonly VariantHeaders[],
  responsePointer: string
): MergedHeader {
  const schemaPointer = headerSchemaPointer(responsePointer, name);
  const appearances = headerAppearancesFor(name, variants, schemaPointer);
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
        appearances.length === variants.length &&
        appearances.every(appearance => appearance.header.required),
      schema,
    },
    warnings,
  };
}

function headerAppearancesFor(
  name: string,
  variants: readonly VariantHeaders[],
  schemaPointer: string
): readonly HeaderAppearance[] {
  return variants.flatMap(variant => {
    const header = ownHeader(variant.headers, name);

    if (header === undefined) {
      return [];
    }

    return [
      {
        responseName: variant.responseName,
        header,
        warnings: variant.warnings.filter(warning =>
          isWarningDocumentPathAtOrBelow(warning, schemaPointer)
        ),
        schemaKey: JSON.stringify(header.schema),
      },
    ];
  });
}

function ownHeader(
  headers: Record<string, OpenApiHeaderObject>,
  name: string
): OpenApiHeaderObject | undefined {
  return Object.prototype.hasOwnProperty.call(headers, name)
    ? headers[name]
    : undefined;
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
  const firstDescription = appearances[0]?.header.description;
  const describedAppearances = appearances.filter(
    appearance => appearance.header.description !== undefined
  );

  if (
    firstDescription !== undefined &&
    appearances.every(
      appearance => appearance.header.description === firstDescription
    )
  ) {
    return firstDescription;
  }

  if (describedAppearances.length === 0) {
    return undefined;
  }

  return [
    "Header description merged from response variants:",
    ...describedAppearances.map(
      appearance =>
        `- ${appearance.responseName}: ${appearance.header.description ?? ""}`
    ),
  ].join("\n");
}
