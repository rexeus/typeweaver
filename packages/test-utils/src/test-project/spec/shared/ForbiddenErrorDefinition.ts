import { defineResponse, HttpStatusCode } from "@rexeus/typeweaver-core";
import { z } from "zod";
import { defaultResponseHeader } from "./defaultResponseHeader";

export const ForbiddenErrorDefinition = defineResponse({
  name: "ForbiddenError",
  body: z.object({
    message: z.literal("Forbidden request"),
    code: z.literal("FORBIDDEN_ERROR"),
  }),
  header: defaultResponseHeader,
  statusCode: HttpStatusCode.FORBIDDEN,
  description: "Forbidden request",
});
