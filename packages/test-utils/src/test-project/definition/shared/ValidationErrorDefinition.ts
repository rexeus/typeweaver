import {
  HttpResponseDefinition,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { z } from "zod";
import { defaultResponseHeader } from "./defaultResponseHeader";

export default new HttpResponseDefinition({
  name: "ValidationError",
  description: "Validation error",
  statusCode: HttpStatusCode.BAD_REQUEST,
  header: defaultResponseHeader,
  body: z.object({
    message: z.literal("Request is invalid"),
    code: z.literal("VALIDATION_ERROR"),
    issues: z.object({
      body: z.array(z.any()).optional(),
      query: z.array(z.any()).optional(),
      param: z.array(z.any()).optional(),
      header: z.array(z.any()).optional(),
    }),
  }),
});
