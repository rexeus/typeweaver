import { z } from "zod/v4";
import {
  HttpOperationDefinition,
  HttpStatusCode,
  HttpMethod,
} from "@rexeus/typeweaver-core";
import {
  sharedResponses,
  defaultResponseHeader,
  defaultRequestHeadersWithPayload,
} from "../shared";

export default new HttpOperationDefinition({
  operationId: "AccessToken",
  path: "/auth/access-token",
  summary: "Get access token by email and password",
  method: HttpMethod.POST,
  request: {
    body: z.object({
      email: z.email().max(256),
      password: z.string().max(256),
    }),
    header: defaultRequestHeadersWithPayload.omit({
      Authorization: true,
    }),
  },
  responses: [
    {
      statusCode: HttpStatusCode.OK,
      description: "Access token created successfully",
      body: z.object({
        accessToken: z.string().max(1028),
        refreshToken: z.string().max(1028),
      }),
      header: defaultResponseHeader,
      name: "AccessTokenSuccess",
    },
    ...sharedResponses,
  ],
});
