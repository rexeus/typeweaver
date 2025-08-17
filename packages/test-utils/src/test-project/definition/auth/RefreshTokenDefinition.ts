import {
  HttpMethod,
  HttpOperationDefinition,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { z } from "zod/v4";
import {
  defaultRequestHeadersWithPayload,
  defaultResponseHeader,
  sharedResponses,
} from "../shared";

export default new HttpOperationDefinition({
  operationId: "RefreshToken",
  path: "/auth/refresh-token",
  summary: "Refresh access token by refresh token",
  method: HttpMethod.POST,
  request: {
    body: z.object({
      refreshToken: z.string().max(1028),
    }),
    header: defaultRequestHeadersWithPayload.omit({
      Authorization: true,
    }),
  },
  responses: [
    {
      statusCode: HttpStatusCode.OK,
      description: "Refreshed token successfully",
      body: z.object({
        accessToken: z.string().max(1028),
        refreshToken: z.string().max(1028),
      }),
      header: defaultResponseHeader,
      name: "RefreshTokenSuccess",
    },
    ...sharedResponses,
  ],
});
