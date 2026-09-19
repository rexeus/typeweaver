import {
  defineOperation,
  defineResponse,
  HttpMethod,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { z } from "zod";

export const GetMetricDefinition = defineOperation({
  operationId: "GetMetric",
  method: HttpMethod.GET,
  path: "/metrics/:metricId",
  summary: "Read a metric through typed HTTP request boundaries",
  request: {
    param: z.object({
      metricId: z.coerce.number().int().positive(),
    }),
    query: z.object({
      enabled: z.stringbool().optional(),
      truthy: z.coerce.boolean().optional(),
      capturedAt: z.coerce.date().optional(),
      samples: z.array(z.coerce.number()).optional(),
    }),
    header: z.object({
      "X-Attempt": z.coerce.number().int(),
      "X-Enabled": z.stringbool().optional(),
      "X-Flags": z.array(z.stringbool()).optional(),
      "X-Note": z.string().optional(),
      "X-Observed-At": z.coerce.date().optional(),
    }),
  },
  responses: [
    defineResponse({
      name: "GetMetricSuccess",
      statusCode: HttpStatusCode.OK,
      description: "The requested metric",
      header: z.object({
        "Content-Type": z.literal("application/json"),
      }),
      body: z.object({
        metricId: z.number().int().positive(),
        enabled: z.boolean(),
      }),
    }),
  ],
});
