import { HttpResponseDefinition, HttpStatusCode } from "@rexeus/typeweaver-core";
import { z } from "zod";
import { defaultResponseHeader } from "./defaultResponseHeader";
export default new HttpResponseDefinition({
  name: "ConflictError",
  body: z.object({
    message: z.literal("Conflicted request"),
    code: z.literal("CONFLICT_ERROR"),
  }),
  header: defaultResponseHeader,
  statusCode: HttpStatusCode.CONFLICT,
  description: "Conflicted request",
});
