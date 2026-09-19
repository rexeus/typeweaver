import {
  defineOperation,
  defineResponse,
  HttpMethod,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { z } from "zod";

export const GetMetricSamplesDefinition = defineOperation({
  operationId: "GetMetricSamples",
  method: HttpMethod.GET,
  path: "/metrics/:metricId/samples",
  summary: "Read metric sample series by label",
  request: {
    param: z.object({
      metricId: z.coerce.number().int().positive(),
    }),
    query: z.record(z.string(), z.array(z.coerce.number())).optional(),
    header: z.record(z.string(), z.array(z.string())).optional(),
  },
  responses: [
    defineResponse({
      name: "GetMetricSamplesSuccess",
      statusCode: HttpStatusCode.OK,
      description: "The parsed sample series by label",
      header: z.object({
        "Content-Type": z.literal("application/json"),
      }),
      body: z.object({
        metricId: z.number().int().positive(),
        samples: z.record(z.string(), z.array(z.number())),
      }),
    }),
  ],
});
