import {
  HttpResponseDefinition,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { z } from "zod/v4";
import { defaultResponseHeader } from "./defaultResponseHeader";

export default new HttpResponseDefinition({
  name: "InternalServerError",
  description: "Internal server error occurred",
  statusCode: HttpStatusCode.INTERNAL_SERVER_ERROR,
  isShared: true,
  header: defaultResponseHeader,
  body: z.object({
    message: z.literal("Internal server error occurred"),
    code: z.literal("INTERNAL_SERVER_ERROR"),
  }),
});
