import {
  HttpResponseDefinition,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { z } from "zod/v4";
import { defaultResponseHeader } from "./defaultResponseHeader";

export default new HttpResponseDefinition({
  name: "UnauthorizedError",
  description: "Unauthorized request",
  statusCode: HttpStatusCode.UNAUTHORIZED,
  isShared: true,
  header: defaultResponseHeader,
  body: z.object({
    message: z.literal("Unauthorized request"),
    code: z.literal("UNAUTHORIZED_ERROR"),
  }),
});
