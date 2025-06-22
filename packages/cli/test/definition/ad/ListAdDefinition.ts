import {
  HttpMethod,
  HttpOperationDefinition,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { listResponseSchema } from "../shared/schemas/listResponseSchema";
import { adSchema } from "./adSchema";
import { sharedResponses } from "../shared/sharedResponses";
import { defaultResponseHeader } from "../shared/defaultResponseHeader";
import { z } from "zod/v4";
import { projectSchema } from "../project/projectSchema";
import { defaultRequestHeadersWithoutPayload } from "../shared/defaultRequestHeader";

export default new HttpOperationDefinition({
  operationId: "ListAd",
  method: HttpMethod.GET,
  path: "/ads",
  summary: "List ads",
  request: {
    query: z.object({
      projectId: projectSchema.shape.id,
    }),
    header: defaultRequestHeadersWithoutPayload,
  },
  responses: [
    {
      name: "ListAdSuccess",
      statusCode: HttpStatusCode.OK,
      description: "List ads successfully",
      body: listResponseSchema(adSchema),
      header: defaultResponseHeader,
    },
    ...sharedResponses,
  ],
});
