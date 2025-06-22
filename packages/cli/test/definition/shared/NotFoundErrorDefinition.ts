import {
  HttpResponseDefinition,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { z } from "zod/v4";
import { defaultResponseHeader } from "./defaultResponseHeader";

export default new HttpResponseDefinition({
  statusCode: HttpStatusCode.NOT_FOUND,
  isShared: true,
  name: "NotFoundError",
  description: "Resource not found",
  header: defaultResponseHeader,
  body: z.object({
    message: z.literal("Resource not found"),
    code: z.literal("NOT_FOUND_ERROR"),
  }),
});
