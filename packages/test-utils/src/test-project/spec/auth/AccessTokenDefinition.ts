import {
  defineOperation,
  defineResponse,
  HttpMethod,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { z } from "zod";
import {
  defaultRequestHeadersWithPayload,
  defaultResponseHeader,
  sharedResponses,
} from "../shared/index.js";

export const AccessTokenDefinition = defineOperation({
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
    defineResponse({
      statusCode: HttpStatusCode.OK,
      description: "Access token created successfully",
      body: z.object({
        accessToken: z.string().max(1028),
        refreshToken: z.string().max(1028),
      }),
      header: defaultResponseHeader,
      name: "AccessTokenSuccess",
    }),
    ...sharedResponses,
  ],
});
