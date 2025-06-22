import {
  HttpMethod,
  HttpOperationDefinition,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { z } from "zod/v4";
import { sharedResponses } from "../shared/sharedResponses";
import { defaultResponseHeader } from "../shared/defaultResponseHeader";
import { defaultRequestHeadersWithPayload } from "../shared/defaultRequestHeader";

export default new HttpOperationDefinition({
  operationId: "Logout",
  path: "/auth/logout",
  summary: "Logout user by refresh token",
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
      statusCode: HttpStatusCode.NO_CONTENT,
      header: defaultResponseHeader,
      description: "Logged out successfully",
      name: "LogoutSuccess",
    },
    ...sharedResponses,
  ],
});
