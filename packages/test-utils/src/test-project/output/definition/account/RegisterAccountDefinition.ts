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
import { accountSchema } from "./accountSchema";

export default new HttpOperationDefinition({
  operationId: "RegisterAccount",
  path: "/accounts",
  summary: "Register new account",
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
      statusCode: HttpStatusCode.CREATED,
      description: "Account created successfully",
      body: accountSchema,
      name: "RegisterAccountSuccess",
      header: defaultResponseHeader,
    },
    ...sharedResponses,
  ],
});
