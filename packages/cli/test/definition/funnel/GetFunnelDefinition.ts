import {
  HttpMethod,
  HttpOperationDefinition,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { funnelSchema } from "./funnelSchema";
import { z } from "zod/v4";
import { sharedResponses } from "../shared/sharedResponses";
import FunnelNotFoundErrorDefinition from "../shared/FunnelNotFoundErrorDefinition";
import { defaultResponseHeader } from "../shared/defaultResponseHeader";
import { defaultRequestHeadersWithoutPayload } from "../shared/defaultRequestHeader";

export default new HttpOperationDefinition({
  operationId: "GetFunnel",
  method: HttpMethod.GET,
  path: "/funnels/:funnelId",
  summary: "Get funnel",
  request: {
    param: z.object({
      funnelId: z.ulid(),
    }),
    header: defaultRequestHeadersWithoutPayload,
  },
  responses: [
    {
      name: "GetFunnelSuccess",
      statusCode: HttpStatusCode.OK,
      description: "Get funnel successfully",
      body: funnelSchema,
      header: defaultResponseHeader,
    },
    FunnelNotFoundErrorDefinition,
    ...sharedResponses,
  ],
});
