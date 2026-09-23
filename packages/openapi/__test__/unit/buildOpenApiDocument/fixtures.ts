import type {
  NormalizedHttpBody,
  NormalizedOperation,
  NormalizedResponse,
  NormalizedResponseUsage,
} from "@rexeus/typeweaver-gen";
import { z } from "zod";
import {
  anInlineResponseUsage,
  anOperationWith,
  aResponseWith,
} from "../../helpers.js";

export const OK_STATUS = 200 as NormalizedResponse["statusCode"];

type ResponseBuilderOverrides = Parameters<typeof aResponseWith>[0];

type OperationBuilderOverrides = Parameters<typeof anOperationWith>[0];

export function anInlineOkResponse(
  overrides: ResponseBuilderOverrides = {}
): NormalizedResponseUsage {
  return anInlineResponseUsage(
    aResponseWith({ statusCode: OK_STATUS, ...overrides })
  );
}

export function aCanonicalOkResponse(
  overrides: ResponseBuilderOverrides = {}
): NormalizedResponse {
  return aResponseWith({ statusCode: OK_STATUS, ...overrides });
}

export function anOperationWithDuplicateOkResponses(
  responses: readonly NormalizedResponseUsage[],
  overrides: OperationBuilderOverrides = {}
): NormalizedOperation {
  return anOperationWith({ ...overrides, responses });
}

export function aTextBody(
  schema: z.ZodType,
  mediaType: string
): NormalizedHttpBody {
  return {
    schema,
    mediaType,
    mediaTypeSource: "content-type-header",
    transport: "text",
  };
}

export function anOctetStreamBody(schema: z.ZodType): NormalizedHttpBody {
  return {
    schema,
    mediaType: "application/octet-stream",
    mediaTypeSource: "content-type-header",
    transport: "raw",
  };
}
