import { isNamedResponseDefinition } from "@rexeus/typeweaver-core";
import type {
  RequestDefinition,
  ResponseDefinition,
} from "@rexeus/typeweaver-core";
import { z } from "zod";
import { normalizeBody } from "./bodyNormalization.js";
import {
  InvalidRequestSchemaError,
  PathParameterMismatchError,
} from "./errors/index.js";
import { getPathParameterNames } from "./helpers/routePath.js";
import { normalizeResponseDefinition } from "./validation/index.js";
import type {
  NormalizedRequest,
  NormalizedResponseUsage,
  NormalizedSpecWarning,
} from "./NormalizedSpec.js";

export type ValidateRequestResult = {
  readonly request?: NormalizedRequest;
  readonly warnings: readonly NormalizedSpecWarning[];
};
export type NormalizeOperationResponsesResult = {
  readonly responses: readonly NormalizedResponseUsage[];
  readonly warnings: readonly NormalizedSpecWarning[];
};
const isZodType = (schema: unknown): schema is z.ZodType =>
  schema instanceof z.ZodType;
const isZodObject = (
  schema: unknown
): schema is z.ZodObject<z.core.$ZodShape> => schema instanceof z.ZodObject;
const validateRequestSchema = (
  operationId: string,
  requestPart: keyof NormalizedRequest,
  schema: unknown
): void => {
  if (!isZodType(schema) || (requestPart === "param" && !isZodObject(schema)))
    throw new InvalidRequestSchemaError({ operationId, requestPart });
};
const hasNoRequestParts = (request: RequestDefinition): boolean =>
  request.header === undefined &&
  request.param === undefined &&
  request.query === undefined &&
  request.body === undefined;
const pathParametersMatch = (
  pathParams: readonly string[],
  requestParams: readonly string[]
): boolean =>
  pathParams.length === requestParams.length &&
  pathParams.every(pathParam => requestParams.includes(pathParam));
export const validateRequest = (
  resourceName: string,
  operationId: string,
  path: string,
  request: RequestDefinition
): ValidateRequestResult => {
  for (const [part, schema] of [
    ["header", request.header],
    ["param", request.param],
    ["query", request.query],
    ["body", request.body],
  ] as const)
    if (schema !== undefined) validateRequestSchema(operationId, part, schema);
  const pathParams = getPathParameterNames(path);
  const requestParams =
    request.param === undefined ? [] : Object.keys(request.param.shape);
  if (!pathParametersMatch(pathParams, requestParams))
    throw new PathParameterMismatchError({
      operationId,
      path,
      pathParams,
      requestParams,
    });
  if (hasNoRequestParts(request)) return { warnings: [] };
  const body = normalizeBody({
    bodySchema: request.body,
    headerSchema: request.header,
    location: { resourceName, operationId, part: "request.body" },
  });
  return {
    request: {
      header: request.header,
      param: request.param,
      query: request.query,
      body: body.body,
    },
    warnings: body.warnings,
  };
};
export const normalizeOperationResponses = (
  resourceName: string,
  operationId: string,
  responses: readonly ResponseDefinition[]
): NormalizeOperationResponsesResult => {
  const warnings: NormalizedSpecWarning[] = [];
  const normalizedResponses = responses.map(response => {
    if (isNamedResponseDefinition(response))
      return {
        responseName: response.name,
        source: "canonical",
      } satisfies NormalizedResponseUsage;
    const normalized = normalizeResponseDefinition(response, {
      resourceName,
      operationId,
      responseName: response.name,
      statusCode: response.statusCode,
    });
    warnings.push(...normalized.warnings);
    return {
      responseName: response.name,
      source: "inline",
      response: normalized.response,
    } satisfies NormalizedResponseUsage;
  });
  return { responses: normalizedResponses, warnings };
};
