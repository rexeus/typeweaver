import { defineResponse, HttpStatusCode } from "@rexeus/typeweaver-core";
import { z } from "zod";
import { defaultResponseHeader } from "./defaultResponseHeader.js";

export const UnauthorizedErrorDefinition = defineResponse({
  name: "UnauthorizedError",
  description: "Unauthorized request",
  statusCode: HttpStatusCode.UNAUTHORIZED,
  header: defaultResponseHeader,
  body: z.object({
    message: z.literal("Unauthorized request"),
    code: z.literal("UNAUTHORIZED_ERROR"),
  }),
});
