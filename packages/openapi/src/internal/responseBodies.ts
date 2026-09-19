import type {
  NormalizedResponse,
  NormalizedResponseUsage,
} from "@rexeus/typeweaver-gen";
import type { JsonSchema } from "@rexeus/typeweaver-zod-to-json-schema";
import { pascalCase } from "polycase";
import { resolveOpenApiBodySchema } from "./bodyContent.js";
import { createOperationLocation } from "./operationContext.js";
import type { OpenApiBuildWarning, OpenApiResponseObject } from "../types.js";
import type { OperationContext } from "./operationContext.js";
import type { SchemaRegistry } from "./schemaRegistry.js";

export type RegisteredBodySchema = {
  readonly mediaType: string;
  readonly schema: JsonSchema;
  readonly schemaKey: string;
  readonly warnings: readonly OpenApiBuildWarning[];
};

/**
 * Minimal structural view of a response variant needed to merge bodies. Kept
 * structural so this module does not depend on the response-object builders.
 */
export type ResponseBodyMergeVariant = {
  readonly response: Pick<NormalizedResponse, "body">;
  readonly usage: NormalizedResponseUsage;
};

export function buildResponseBody(
  response: NormalizedResponse,
  options: {
    readonly schemaRegistry: SchemaRegistry;
    readonly context: OperationContext;
    readonly responseName: string;
    readonly statusCode: string;
    readonly baseName: string;
  }
): {
  readonly content?: OpenApiResponseObject["content"];
  readonly warnings: readonly OpenApiBuildWarning[];
} {
  const body = response.body;

  if (body === undefined) {
    return { warnings: [] };
  }

  const registration = registerResponseBody(body, {
    schemaRegistry: options.schemaRegistry,
    context: options.context,
    responseName: options.responseName,
    statusCode: options.statusCode,
    baseName: options.baseName,
  });

  return {
    content: {
      [body.mediaType]: {
        schema: registration.schema,
      },
    },
    warnings: registration.warnings,
  };
}

export function buildMergedResponseBody(
  variants: readonly ResponseBodyMergeVariant[],
  options: {
    readonly schemaRegistry: SchemaRegistry;
    readonly context: OperationContext;
    readonly statusCode: string;
  }
): {
  readonly content?: OpenApiResponseObject["content"];
  readonly warnings: readonly OpenApiBuildWarning[];
} {
  const warnings: OpenApiBuildWarning[] = [];
  const schemasByMediaType = new Map<string, RegisteredBodySchema[]>();

  for (const variant of variants) {
    const body = variant.response.body;

    if (body === undefined) {
      continue;
    }

    const registration = registerResponseBody(body, {
      schemaRegistry: options.schemaRegistry,
      context: options.context,
      baseName: responseBodyBaseName(options.context, variant.usage),
      responseName: variant.usage.responseName,
      statusCode: options.statusCode,
    });
    const schemas = schemasByMediaType.get(body.mediaType) ?? [];

    schemasByMediaType.set(body.mediaType, [...schemas, registration]);
    warnings.push(...registration.warnings);
  }

  if (schemasByMediaType.size === 0) {
    return { warnings };
  }

  return {
    content: Object.fromEntries(
      Array.from(schemasByMediaType, ([mediaType, registrations]) => [
        mediaType,
        { schema: mergedMediaTypeSchema(registrations) },
      ])
    ),
    warnings,
  };
}

export function responseBodyBaseName(
  context: OperationContext,
  usage: NormalizedResponseUsage
): string {
  return usage.source === "canonical"
    ? `${usage.responseName}Body`
    : inlineResponseBodyBaseName(context, usage.responseName);
}

export function inlineResponseBodyBaseName(
  context: OperationContext,
  responseName: string
): string {
  return `${pascalCase(context.operation.operationId)}${responseName}Body`;
}

function mergedMediaTypeSchema(
  registrations: readonly RegisteredBodySchema[]
): JsonSchema {
  const distinctSchemas = distinctBy(
    registrations,
    registration => registration.schemaKey
  ).map(registration => registration.schema);
  const firstSchema = distinctSchemas[0];

  if (firstSchema === undefined) {
    return {};
  }

  const otherSchemas = distinctSchemas.slice(1);

  return otherSchemas.length === 0 ? firstSchema : { anyOf: distinctSchemas };
}

function registerResponseBody(
  body: NonNullable<NormalizedResponse["body"]>,
  options: {
    readonly schemaRegistry: SchemaRegistry;
    readonly context: OperationContext;
    readonly responseName: string;
    readonly statusCode: string;
    readonly baseName: string;
  }
): RegisteredBodySchema {
  const resolvedSchema = resolveOpenApiBodySchema<OpenApiBuildWarning>(
    body,
    () => {
      const registration = options.schemaRegistry.register({
        schema: body.schema,
        baseName: options.baseName,
        location: createOperationLocation({
          context: options.context,
          part: "response.body",
          responseName: options.responseName,
          statusCode: options.statusCode,
        }),
      });

      return {
        schema: registration.ref,
        schemaKey: registration.ref.$ref,
        warnings: registration.warnings,
      };
    }
  );

  return { mediaType: body.mediaType, ...resolvedSchema };
}

function distinctBy<T>(
  values: readonly T[],
  keyForValue: (value: T) => string
): readonly T[] {
  const seen = new Set<string>();
  const distinctValues: T[] = [];

  for (const value of values) {
    const key = keyForValue(value);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    distinctValues.push(value);
  }

  return distinctValues;
}
