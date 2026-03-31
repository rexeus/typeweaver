import { defineResponse, HttpStatusCode } from "@rexeus/typeweaver-core";
import { z } from "zod";
import { defaultResponseHeader } from "./defaultResponseHeader";

export const TooManyRequestsErrorDefinition = defineResponse({
  name: "TooManyRequestsError",
  description: "Too many requests",
  statusCode: HttpStatusCode.TOO_MANY_REQUESTS,
  header: defaultResponseHeader,
  body: z.object({
    message: z.literal("Too many requests"),
    code: z.literal("TOO_MANY_REQUESTS_ERROR"),
  }),
});
