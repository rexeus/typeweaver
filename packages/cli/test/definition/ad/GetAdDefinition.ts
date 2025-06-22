import {
  HttpMethod,
  HttpOperationDefinition,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { z } from "zod/v4";
import { sharedResponses } from "../shared/sharedResponses";
import { defaultResponseHeader } from "../shared/defaultResponseHeader";
import { defaultRequestHeadersWithoutPayload } from "../shared/defaultRequestHeader";
import { adSchema } from "./adSchema";
import AdNotFoundErrorDefinition from "../shared/AdNotFoundErrorDefinition";

export default new HttpOperationDefinition({
  operationId: "GetAd",
  method: HttpMethod.GET,
  path: "/ads/:adId",
  summary: "Get ad",
  request: {
    param: z.object({
      adId: z.ulid(),
    }),
    header: defaultRequestHeadersWithoutPayload,
  },
  responses: [
    {
      name: "GetAdSuccess",
      statusCode: HttpStatusCode.OK,
      description: "Get ad successfully",
      body: adSchema,
      header: defaultResponseHeader,
    },
    AdNotFoundErrorDefinition,
    ...sharedResponses,
  ],
});
