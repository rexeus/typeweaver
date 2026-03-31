import { defineResponse, HttpStatusCode } from "@rexeus/typeweaver-core";
import { z } from "zod";
import { defaultResponseHeader } from "./defaultResponseHeader";

export const NotFoundErrorDefinition = defineResponse({
  statusCode: HttpStatusCode.NOT_FOUND,
  name: "NotFoundError",
  description: "Resource not found",
  header: defaultResponseHeader,
  body: z.object({
    message: z.literal("Resource not found"),
    code: z.literal("NOT_FOUND_ERROR"),
  }),
});
