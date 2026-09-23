import { z } from "zod";
import {
  defineResponse,
  HttpMethod,
  HttpStatusCode,
} from "../../../src/index.js";
import type { RequestDefinition } from "../../../src/index.js";

export const successResponse = defineResponse({
  name: "HttpBoundarySuccess",
  statusCode: HttpStatusCode.OK,
  description: "A typed HTTP-boundary request was accepted.",
  header: z.object({}),
  body: z.object({ ok: z.literal(true) }),
});

export const operationWithQuery = <TQuery extends RequestDefinition["query"]>(
  query: TQuery
) => ({
  operationId: "boundaryQuery",
  path: "/metrics",
  method: HttpMethod.GET,
  summary: "Boundary query",
  request: { query },
  responses: [successResponse],
});

export const operationWithQueryRecordValue = <TValue extends z.ZodType>(
  value: TValue
) => operationWithQuery(z.record(z.string(), value));
