import {
  defineOperation,
  defineResponse,
  HttpMethod,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { z } from "zod";

export const GetMetricKeyedLabelsDefinition = defineOperation({
  operationId: "GetMetricKeyedLabels",
  method: HttpMethod.GET,
  path: "/metrics/:metricId/keyed-labels",
  summary: "Read label records whose key schema must preserve raw keys",
  request: {
    param: z.object({
      metricId: z.coerce.number().int().positive(),
    }),
    query: z.record(z.string().trim(), z.coerce.number()).optional(),
    header: z.record(z.string().toLowerCase(), z.stringbool()).optional(),
  },
  responses: [
    defineResponse({
      name: "GetMetricKeyedLabelsSuccess",
      statusCode: HttpStatusCode.OK,
      description: "The parsed keyed label records",
      header: z.object({
        "Content-Type": z.literal("application/json"),
      }),
      body: z.object({
        metricId: z.number().int().positive(),
        labels: z.record(z.string(), z.number()),
      }),
    }),
  ],
});
