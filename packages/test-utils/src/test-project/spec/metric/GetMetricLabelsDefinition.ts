import {
  defineOperation,
  defineResponse,
  HttpMethod,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { z } from "zod";

export const GetMetricLabelsDefinition = defineOperation({
  operationId: "GetMetricLabels",
  method: HttpMethod.GET,
  path: "/metrics/:metricId/labels",
  summary: "Read dynamic metric label records",
  request: {
    param: z.object({
      metricId: z.coerce.number().int().positive(),
    }),
    query: z.record(z.string(), z.coerce.number()).optional(),
    header: z.record(z.string(), z.stringbool()).optional(),
  },
  responses: [
    defineResponse({
      name: "GetMetricLabelsSuccess",
      statusCode: HttpStatusCode.OK,
      description: "The parsed metric label records",
      header: z.object({
        "Content-Type": z.literal("application/json"),
      }),
      body: z.object({
        metricId: z.number().int().positive(),
        labels: z.record(z.string(), z.number()),
        flags: z.record(z.string(), z.boolean()),
      }),
    }),
  ],
});
