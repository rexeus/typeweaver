import {
  HttpMethod,
  HttpOperationDefinition,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { listResponseSchema } from "../shared/schemas/listResponseSchema";
import { funnelSchema } from "./funnelSchema";
import { sharedResponses } from "../shared/sharedResponses";
import { defaultResponseHeader } from "../shared/defaultResponseHeader";
import { z } from "zod/v4";
import { projectSchema } from "../project/projectSchema";
import { defaultRequestHeadersWithoutPayload } from "../shared/defaultRequestHeader";
import NonExistingProjectErrorDefinition from "../shared/NonExistingProjectErrorDefinition";

export default new HttpOperationDefinition({
  operationId: "ListFunnel",
  method: HttpMethod.GET,
  path: "/funnels",
  summary: "List funnels",
  request: {
    query: z.object({
      projectId: projectSchema.shape.id,
    }),
    header: defaultRequestHeadersWithoutPayload,
  },
  responses: [
    {
      name: "ListFunnelSuccess",
      statusCode: HttpStatusCode.OK,
      description: "List funnels successfully",
      body: listResponseSchema(funnelSchema),
      header: defaultResponseHeader,
    },
    NonExistingProjectErrorDefinition,
    ...sharedResponses,
  ],
});
