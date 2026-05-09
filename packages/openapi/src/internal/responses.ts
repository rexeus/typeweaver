import type {
  NormalizedResponse,
  NormalizedResponseUsage,
} from "@rexeus/typeweaver-gen";
import { escapeJsonPointerSegment, jsonPointer } from "./jsonPointer.js";
import { buildHeaderObjects } from "./parameters.js";
import { convertSchema, unwrapRootOptional } from "./schemaConversion.js";
import type {
  OpenApiBuildWarning,
  OpenApiDiagnosticWarning,
  OpenApiResponseObject,
  OpenApiResponsesObject,
} from "../types.js";
import type { OperationContext } from "./parameters.js";

export type ComponentsResponsesResult = {
  readonly responses: Record<string, OpenApiResponseObject>;
  readonly warnings: readonly OpenApiBuildWarning[];
};

export type OperationResponsesResult = {
  readonly responses: OpenApiResponsesObject;
  readonly warnings: readonly OpenApiBuildWarning[];
};

export function buildComponentsResponses(
  responses: readonly NormalizedResponse[]
): ComponentsResponsesResult {
  const warnings: OpenApiBuildWarning[] = [];
  const componentsResponses = Object.fromEntries(
    responses.map(response => {
      const responsePointer = jsonPointer([
        "components",
        "responses",
        response.name,
      ]);
      const built = buildResponseObject(response, {
        responseName: response.name,
        statusCode: String(response.statusCode),
        responsePointer,
      });

      warnings.push(...built.warnings);

      return [response.name, built.response];
    })
  );

  return { responses: componentsResponses, warnings };
}

export function buildOperationResponses(
  usages: readonly NormalizedResponseUsage[],
  canonicalResponsesByName: ReadonlyMap<string, NormalizedResponse>,
  context: OperationContext
): OperationResponsesResult {
  const warnings: OpenApiBuildWarning[] = [];
  const responses: OpenApiResponsesObject = {};
  const responsesPointer = jsonPointer([
    "paths",
    context.openApiPath,
    context.method,
    "responses",
  ]);

  for (const usage of usages) {
    const response = resolveResponse(usage, canonicalResponsesByName);

    if (response === undefined) {
      warnings.push(
        createBuilderWarning({
          code: "missing-canonical-response",
          message: `Canonical response '${usage.responseName}' is not defined.`,
          documentPath: responsesPointer,
          context,
          part: "response",
          responseName: usage.responseName,
        })
      );
      continue;
    }

    const statusCode = String(response.statusCode);

    if (Object.prototype.hasOwnProperty.call(responses, statusCode)) {
      warnings.push(
        createBuilderWarning({
          code: "duplicate-response-status",
          message: `Response status '${statusCode}' is already defined for this operation.`,
          documentPath: `${responsesPointer}/${statusCode}`,
          context,
          part: "response",
          responseName: usage.responseName,
          statusCode,
        })
      );
      continue;
    }

    if (usage.source === "canonical") {
      responses[statusCode] = {
        $ref: `#/components/responses/${escapeJsonPointerSegment(usage.responseName)}`,
      };
      continue;
    }

    const responsePointer = `${responsesPointer}/${statusCode}`;
    const built = buildResponseObject(response, {
      context,
      responseName: usage.responseName,
      statusCode,
      responsePointer,
    });

    responses[statusCode] = built.response;
    warnings.push(...built.warnings);
  }

  return { responses, warnings };
}

function resolveResponse(
  usage: NormalizedResponseUsage,
  canonicalResponsesByName: ReadonlyMap<string, NormalizedResponse>
): NormalizedResponse | undefined {
  if (usage.source === "inline") {
    return usage.response;
  }

  const response = canonicalResponsesByName.get(usage.responseName);

  if (response !== undefined) {
    return response;
  }

  return undefined;
}

function buildResponseObject(
  response: NormalizedResponse,
  options: {
    readonly context?: OperationContext;
    readonly responseName: string;
    readonly statusCode: string;
    readonly responsePointer: string;
  }
): {
  readonly response: OpenApiResponseObject;
  readonly warnings: readonly OpenApiBuildWarning[];
} {
  const context =
    options.context ?? createComponentResponseContext(options.responseName);
  const headers = buildHeaderObjects(response.header, context, {
    responseName: options.responseName,
    statusCode: options.statusCode,
    part: "response.header",
    headersPointer: `${options.responsePointer}/headers`,
  });
  const body = buildResponseBody(response, {
    context,
    responseName: options.responseName,
    statusCode: options.statusCode,
    schemaPointer: `${options.responsePointer}/content/application~1json/schema`,
  });

  return {
    response: {
      description: response.description,
      ...(Object.keys(headers.headers).length > 0
        ? { headers: headers.headers }
        : {}),
      ...(body.content === undefined ? {} : { content: body.content }),
    },
    warnings: [...headers.warnings, ...body.warnings],
  };
}

function buildResponseBody(
  response: NormalizedResponse,
  options: {
    readonly context: OperationContext;
    readonly responseName: string;
    readonly statusCode: string;
    readonly schemaPointer: string;
  }
): {
  readonly content?: OpenApiResponseObject["content"];
  readonly warnings: readonly OpenApiBuildWarning[];
} {
  if (response.body === undefined) {
    return { warnings: [] };
  }

  const schema = unwrapRootOptional(response.body).schema;
  const converted = convertSchema(schema, options.schemaPointer, {
    resourceName: options.context.resourceName,
    operationId: options.context.operation.operationId,
    method: options.context.operation.method,
    path: options.context.operation.path,
    openApiPath: options.context.openApiPath,
    part: "response.body",
    responseName: options.responseName,
    statusCode: options.statusCode,
  });

  return {
    content: {
      "application/json": {
        schema: converted.schema,
      },
    },
    warnings: converted.warnings,
  };
}

function createComponentResponseContext(
  responseName: string
): OperationContext {
  return {
    resourceName: "components.responses",
    operation: {
      operationId: responseName,
      method: "components",
      path: "#/components/responses",
    },
    openApiPath: "#/components/responses",
    method: "components",
  };
}

function createBuilderWarning(options: {
  readonly code: OpenApiDiagnosticWarning["code"];
  readonly message: string;
  readonly documentPath: string;
  readonly context: OperationContext;
  readonly part: string;
  readonly responseName?: string;
  readonly statusCode?: string;
}): OpenApiDiagnosticWarning {
  return {
    origin: "openapi-builder",
    code: options.code,
    message: options.message,
    documentPath: options.documentPath,
    location: {
      resourceName: options.context.resourceName,
      operationId: options.context.operation.operationId,
      method: options.context.operation.method,
      path: options.context.operation.path,
      openApiPath: options.context.openApiPath,
      part: options.part,
      responseName: options.responseName,
      statusCode: options.statusCode,
    },
  };
}
