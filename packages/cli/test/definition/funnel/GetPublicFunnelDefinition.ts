import {
  HttpMethod,
  HttpOperationDefinition,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { z } from "zod/v4";
import { sharedResponses } from "../shared/sharedResponses";
import FunnelNotFoundErrorDefinition from "../shared/FunnelNotFoundErrorDefinition";
import { defaultResponseHeader } from "../shared/defaultResponseHeader";
import { defaultRequestHeadersWithoutPayload } from "../shared/defaultRequestHeader";
import { publicFunnelSchema } from "./publicFunnelSchema";

export default new HttpOperationDefinition({
  operationId: "GetPublicFunnel",
  method: HttpMethod.GET,
  path: "/public-funnels/:funnelId",
  summary: "Get public funnel",
  request: {
    param: z.object({
      funnelId: z.ulid(),
    }),
    header: defaultRequestHeadersWithoutPayload.omit({
      Authorization: true,
    }),
  },
  responses: [
    {
      name: "GetPublicFunnelSuccess",
      statusCode: HttpStatusCode.OK,
      description: "Get public funnel successfully",
      body: publicFunnelSchema,
      header: defaultResponseHeader,
    },
    FunnelNotFoundErrorDefinition,
    ...sharedResponses,
  ],
});
